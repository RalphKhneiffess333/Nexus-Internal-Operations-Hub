import { describe, expect, it, jest } from '@jest/globals';
import { TicketStatus } from '@prisma/client';
import { AuditLogsCleanupWorker } from './audit-logs-cleanup.worker';
import { AuditLogsCleanupRepository } from './audit-logs-cleanup.repository';
import { OrphanedFilesWorker } from './orphaned-files.worker';
import { OrphanedFilesRepository } from './orphaned-files.repository';
import { UnclaimedTicketReminderWorker } from './unclaimed-ticket-reminder.worker';
import { UnclaimedTicketReminderRepository } from './unclaimed-ticket-reminder.repository';
import type { PrismaService } from '../database/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { FileStorage } from '../files/file-storage.interface';
import type { NotificationsService } from '../notifications/notifications.service';
import type { EmailNotificationsService } from '../notifications/email-notifications.service';

describe('background workers', () => {
  it('notifies department members once when an unclaimed ticket reaches its interval', async () => {
    const now = new Date('2026-09-19T12:00:00.000Z');
    const candidates = [
      {
        ticketId: 'ticket-1',
        ticketCode: 'TKT-0001',
        title: 'Laptop issue',
        departmentId: 'department-1',
        priority: 'HIGH',
        unclaimedSince: new Date('2026-09-19T07:00:00.000Z'),
      },
    ];
    const prisma = {
      ticket: {
        findMany: jest
          .fn<() => Promise<typeof candidates>>()
          .mockResolvedValue(candidates),
        updateMany: jest
          .fn<() => Promise<{ count: number }>>()
          .mockResolvedValue({ count: 1 }),
      },
      priority: {
        findMany: jest
          .fn<() => Promise<Array<{ code: string; reminderIntervalMinutes: number }>>>()
          .mockResolvedValue([
            { code: 'HIGH', reminderIntervalMinutes: 240 },
          ]),
      },
    };
    const notifications = {
      notifyDepartmentAgents: jest
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined),
    };
    const emailNotifications = {
      notifyTicketReminder: jest
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined),
    };

    const repository = new UnclaimedTicketReminderRepository(
      prisma as unknown as PrismaService,
    );
    const worker = new UnclaimedTicketReminderWorker(
      repository,
      notifications as unknown as NotificationsService,
      emailNotifications as unknown as EmailNotificationsService,
    );

    await worker.runOnce(now);

    expect(prisma.ticket.updateMany as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ticketId: 'ticket-1',
          status: { in: [TicketStatus.OPEN, TicketStatus.REOPENED] },
          lastReminderAt: null,
        }),
        data: { lastReminderAt: now },
      }),
    );
    expect(
      notifications.notifyDepartmentAgents as jest.Mock,
    ).toHaveBeenCalledWith(
      'department-1',
      expect.objectContaining({
        type: 'TICKET_REMINDER',
        ticketId: 'ticket-1',
      }),
    );
    expect(
      emailNotifications.notifyTicketReminder as jest.Mock,
    ).toHaveBeenCalledWith('ticket-1');
  });

  it('deletes only expired audit logs through the cleanup transaction', async () => {
    const now = new Date('2026-09-19T12:00:00.000Z');
    const tx = {
      $executeRaw: jest.fn<() => Promise<number>>().mockResolvedValue(0),
      auditLog: {
        deleteMany: jest
          .fn<() => Promise<{ count: number }>>()
          .mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      auditLog: {
        findMany: jest
          .fn<() => Promise<Array<{ auditLogId: string }>>>()
          .mockResolvedValueOnce([{ auditLogId: 'audit-1' }])
          .mockResolvedValueOnce([]),
      },
      $transaction: jest.fn((operation: (client: typeof tx) => unknown) =>
        Promise.resolve(operation(tx)),
      ),
    };

    const repository = new AuditLogsCleanupRepository(
      prisma as unknown as PrismaService,
    );
    const worker = new AuditLogsCleanupWorker(repository);

    await worker.runOnce(now);

    expect(tx.$executeRaw as jest.Mock).toHaveBeenCalled();
    expect(tx.auditLog.deleteMany as jest.Mock).toHaveBeenCalledWith({
      where: { auditLogId: { in: ['audit-1'] } },
    });
    expect(prisma.auditLog.findMany as jest.Mock).toHaveBeenCalledTimes(2);
  });

  it('removes stale database file records and their physical file', async () => {
    const now = new Date('2026-09-19T12:00:00.000Z');
    const tx = {
      attachment: {
        deleteMany: jest
          .fn<() => Promise<{ count: number }>>()
          .mockResolvedValue({ count: 0 }),
      },
      file: {
        delete: jest
          .fn<() => Promise<Record<string, never>>>()
          .mockResolvedValue({}),
      },
    };
    const prisma = {
      file: {
        findMany: jest
          .fn<
            () => Promise<
              Array<{
                fileId: string;
                storageKey: string;
                createdAt: Date;
                attachment: null;
              }>
            >
          >()
          .mockResolvedValue([
            {
              fileId: 'file-1',
              storageKey: 'file-1',
              createdAt: new Date('2026-09-18T00:00:00.000Z'),
              attachment: null,
            },
          ]),
      },
      $transaction: jest.fn((operation: (client: typeof tx) => unknown) =>
        Promise.resolve(operation(tx)),
      ),
    };
    const storage = {
      list: jest
        .fn<() => Promise<Array<{ storageKey: string; modifiedAt: Date }>>>()
        .mockResolvedValue([
          {
            storageKey: 'file-1',
            modifiedAt: new Date('2026-09-18T00:00:00.000Z'),
          },
        ]),
      exists: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
      delete: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };

    const repository = new OrphanedFilesRepository(
      prisma as unknown as PrismaService,
    );
    const worker = new OrphanedFilesWorker(
      repository,
      { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService,
      storage as unknown as FileStorage,
    );

    await worker.runOnce(now);

    expect(tx.file.delete as jest.Mock).toHaveBeenCalledWith({
      where: { fileId: 'file-1' },
    });
    expect(storage.delete as jest.Mock).toHaveBeenCalledWith('file-1');
  });
});
