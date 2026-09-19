import { describe, expect, it, jest } from '@jest/globals';
import { TicketPriority, TicketStatus } from '@prisma/client';
import { AuditLogsCleanupWorker } from './audit-logs-cleanup.worker';
import { OrphanedFilesWorker } from './orphaned-files.worker';
import { UnclaimedTicketReminderWorker } from './unclaimed-ticket-reminder.worker';
import type { PrismaService } from '../database/prisma.service';
import type { FileStorage } from '../files/file-storage.interface';
import type { NotificationsService } from '../notifications/notifications.service';
import type { EmailNotificationsService } from '../notifications/email-notifications.service';

describe('background workers', () => {
  it('notifies department members once when an unclaimed ticket reaches its interval', async () => {
    const now = new Date('2026-09-19T12:00:00.000Z');
    const prisma = {
      ticket: {
        findMany: jest.fn().mockResolvedValue([
          {
            ticketId: 'ticket-1',
            ticketCode: 'TKT-0001',
            title: 'Laptop issue',
            departmentId: 'department-1',
            priority: TicketPriority.HIGH,
            unclaimedSince: new Date('2026-09-19T07:00:00.000Z'),
          },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      systemConfiguration: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { key: 'REMINDER_INTERVAL_HIGH_MINUTES', value: '240' },
          ]),
      },
    };
    const notifications = {
      notifyDepartmentAgents: jest.fn().mockResolvedValue(undefined),
    };
    const emailNotifications = {
      notifyTicketReminder: jest.fn().mockResolvedValue(undefined),
    };

    const worker = new UnclaimedTicketReminderWorker(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
      emailNotifications as unknown as EmailNotificationsService,
    );

    await worker.runOnce(now);

    expect(prisma.ticket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ticketId: 'ticket-1',
          status: { in: [TicketStatus.OPEN, TicketStatus.REOPENED] },
          lastReminderAt: null,
        }),
        data: { lastReminderAt: now },
      }),
    );
    expect(notifications.notifyDepartmentAgents).toHaveBeenCalledWith(
      'department-1',
      expect.objectContaining({
        type: 'TICKET_REMINDER',
        ticketId: 'ticket-1',
      }),
    );
    expect(emailNotifications.notifyTicketReminder).toHaveBeenCalledWith(
      'ticket-1',
    );
  });

  it('deletes only expired audit logs through the cleanup transaction', async () => {
    const now = new Date('2026-09-19T12:00:00.000Z');
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      auditLog: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      auditLog: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ auditLogId: 'audit-1' }])
          .mockResolvedValueOnce([]),
      },
      $transaction: jest.fn((operation: (client: typeof tx) => unknown) =>
        Promise.resolve(operation(tx)),
      ),
    };

    const worker = new AuditLogsCleanupWorker(
      prisma as unknown as PrismaService,
    );

    await worker.runOnce(now);

    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.auditLog.deleteMany).toHaveBeenCalledWith({
      where: { auditLogId: { in: ['audit-1'] } },
    });
    expect(prisma.auditLog.findMany).toHaveBeenCalledTimes(2);
  });

  it('removes stale database file records and their physical file', async () => {
    const now = new Date('2026-09-19T12:00:00.000Z');
    const tx = {
      attachment: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      file: { delete: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      file: {
        findMany: jest.fn().mockResolvedValue([
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
      list: jest.fn().mockResolvedValue([
        {
          storageKey: 'file-1',
          modifiedAt: new Date('2026-09-18T00:00:00.000Z'),
        },
      ]),
      exists: jest.fn().mockResolvedValue(true),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const worker = new OrphanedFilesWorker(
      prisma as unknown as PrismaService,
      storage as unknown as FileStorage,
    );

    await worker.runOnce(now);

    expect(tx.file.delete).toHaveBeenCalledWith({
      where: { fileId: 'file-1' },
    });
    expect(storage.delete).toHaveBeenCalledWith('file-1');
  });
});
