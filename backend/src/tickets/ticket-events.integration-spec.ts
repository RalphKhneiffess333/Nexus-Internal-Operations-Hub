import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import {
  TicketEventAction,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TicketEventsRepository } from './events/ticket-events.repository';
import type { UploadedFileInput } from '../files/file-validation';
import { TicketsService } from './tickets.service';
import {
  AGENT_2_ID,
  EMPLOYEE_2_ID,
  EMPLOYEE_ID,
  HR_DEPARTMENT_ID,
  IT_DEPARTMENT_ID,
  adminUser,
  agentUser,
  claimTicket,
  closeTicket,
  createTicketsTestingModule,
  requestUser,
  submitDto,
  submitOpenTicket,
} from './tickets.test-utils';

describe('Ticket events integration', () => {
  let service: TicketsService;
  let prisma: PrismaService;
  let eventsRepository: TicketEventsRepository;
  let moduleRef: Awaited<ReturnType<typeof createTicketsTestingModule>>;

  beforeEach(async () => {
    moduleRef = await createTicketsTestingModule();
    service = moduleRef.get(TicketsService);
    prisma = moduleRef.get(PrismaService);
    eventsRepository = moduleRef.get(TicketEventsRepository);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('records typed snapshots for a complete ticket lifecycle', async () => {
    const submitted = await submitOpenTicket(service);
    const modified = await service.modify(
      submitted.ticketId,
      {
        title: 'Laptop power failure',
        departmentId: HR_DEPARTMENT_ID,
      },
      requestUser(),
    );
    await claimTicket(service, modified.ticketId, agentUser(AGENT_2_ID));
    await closeTicket(service, modified.ticketId, agentUser(AGENT_2_ID));
    await service.reopen(
      modified.ticketId,
      { description: 'The replacement adapter also failed' },
      requestUser(),
    );

    const events = await service.findEvents(modified.ticketId, requestUser());

    expect(events.map((event) => event.action)).toEqual([
      TicketEventAction.SUBMISSION,
      TicketEventAction.MODIFICATION,
      TicketEventAction.CLAIM,
      TicketEventAction.CLOSE,
      TicketEventAction.REOPEN,
    ]);
    expect(events[0]).toMatchObject({
      ticketId: modified.ticketId,
      user: { userId: EMPLOYEE_ID },
      action: TicketEventAction.SUBMISSION,
      details: {
        title: 'Laptop will not start',
        departmentId: IT_DEPARTMENT_ID,
        priority: TicketPriority.HIGH,
        description: 'The laptop stays on a black screen',
        submitter: { userId: EMPLOYEE_ID },
      },
    });
    expect(events[1]).toMatchObject({
      user: { userId: EMPLOYEE_ID },
      action: TicketEventAction.MODIFICATION,
      details: {
        oldTitle: 'Laptop will not start',
        newTitle: 'Laptop power failure',
        oldDepartmentId: IT_DEPARTMENT_ID,
        newDepartmentId: HR_DEPARTMENT_ID,
        oldPriority: TicketPriority.HIGH,
        newPriority: TicketPriority.HIGH,
        oldDescription: 'The laptop stays on a black screen',
        newDescription: 'The laptop stays on a black screen',
      },
    });
    expect(events[2]).toMatchObject({
      user: { userId: AGENT_2_ID },
      action: TicketEventAction.CLAIM,
      details: {
        agent: { userId: AGENT_2_ID },
      },
    });
    expect(events[2].details).toHaveProperty('timestamp');
    expect(events[3]).toMatchObject({
      user: { userId: AGENT_2_ID },
      action: TicketEventAction.CLOSE,
      details: {
        agent: { userId: AGENT_2_ID },
        completionNotes: 'Replaced the power adapter',
      },
    });
    expect(events[4]).toMatchObject({
      user: { userId: EMPLOYEE_ID },
      action: TicketEventAction.REOPEN,
      details: {
        priority: TicketPriority.HIGH,
        description: 'The replacement adapter also failed',
        submitter: { userId: EMPLOYEE_ID },
      },
    });
    expect(events.every((event) => Boolean(event.ticketEventId))).toBe(true);
  });

  it('stores submission, close, and reopen attachments on their events', async () => {
    const upload = (name: string, contents: string): UploadedFileInput => ({
      originalname: name,
      mimetype: 'text/plain',
      size: Buffer.byteLength(contents),
      buffer: Buffer.from(contents),
    });

    const physicalFiles: string[] = [];
    try {
      const submitted = await service.submit(
        submitDto(),
        requestUser(),
        [upload('submission.txt', 'submitted')],
      );
      await claimTicket(service, submitted.ticketId);
      await closeTicket(
        service,
        submitted.ticketId,
        agentUser(),
        [upload('close.txt', 'closed')],
      );
      await service.reopen(
        submitted.ticketId,
        { description: 'Still needs attention' },
        requestUser(),
        [upload('reopen.txt', 'reopened')],
      );

      const events = await service.findEvents(submitted.ticketId, requestUser());
      const submission = events.find(
        (event) => event.action === TicketEventAction.SUBMISSION,
      );
      const close = events.find((event) => event.action === TicketEventAction.CLOSE);
      const reopen = events.find((event) => event.action === TicketEventAction.REOPEN);

      expect(submission?.attachments).toHaveLength(1);
      expect(submission?.attachments[0].originalName).toBe('submission.txt');
      expect(close?.attachments).toHaveLength(1);
      expect(close?.attachments[0].originalName).toBe('close.txt');
      expect(reopen?.attachments).toHaveLength(1);
      expect(reopen?.attachments[0].originalName).toBe('reopen.txt');

      const storedFiles = await prisma.file.findMany();
      expect(storedFiles).toHaveLength(3);
      physicalFiles.push(...storedFiles.map((file) => file.storageKey));
      for (const storageKey of physicalFiles) {
        await expect(
          fs.access(resolve(process.cwd(), 'uploads', storageKey)),
        ).resolves.toBeUndefined();
      }
    } finally {
      await Promise.all(
        physicalFiles.map((storageKey) =>
          fs.rm(resolve(process.cwd(), 'uploads', storageKey), { force: true }),
        ),
      );
    }
  });

  it('adds and removes attachments when an open ticket is modified', async () => {
    const upload = (name: string, contents: string): UploadedFileInput => ({
      originalname: name,
      mimetype: 'text/plain',
      size: Buffer.byteLength(contents),
      buffer: Buffer.from(contents),
    });

    const submitted = await service.submit(
      submitDto(),
      requestUser(),
      [upload('old-description.txt', 'old description')],
    );
    const submissionEvents = await service.findEvents(
      submitted.ticketId,
      requestUser(),
    );
    const oldAttachment = submissionEvents[0].attachments[0];
    const oldFile = await prisma.file.findUnique({
      where: { fileId: oldAttachment.fileId },
    });

    await service.modify(
      submitted.ticketId,
      {
        description: 'Updated description',
        removedAttachmentIds: JSON.stringify([oldAttachment.attachmentId]),
      },
      requestUser(),
      [upload('new-description.txt', 'new description')],
    );

    const events = await service.findEvents(submitted.ticketId, requestUser());
    const submission = events.find(
      (event) => event.action === TicketEventAction.SUBMISSION,
    );
    const modification = events.find(
      (event) => event.action === TicketEventAction.MODIFICATION,
    );
    expect(submission?.attachments).toHaveLength(0);
    expect(modification?.attachments).toMatchObject([
      { originalName: 'new-description.txt' },
    ]);

    const storedFiles = await prisma.file.findMany();
    expect(storedFiles).toHaveLength(1);
    expect(storedFiles[0].originalName).toBe('new-description.txt');
    await expect(
      fs.access(resolve(process.cwd(), 'uploads', oldFile!.storageKey)),
    ).rejects.toMatchObject({ code: 'ENOENT' });

    await fs.rm(resolve(process.cwd(), 'uploads', storedFiles[0].storageKey), {
      force: true,
    });
  });

  it('records DELETE while preserving the soft-deleted ticket', async () => {
    const submitted = await submitOpenTicket(service);

    await service.cancel(submitted.ticketId, requestUser());

    const stored = await prisma.ticket.findUnique({
      where: { ticketId: submitted.ticketId },
    });
    const events = await eventsRepository.findByTicketId(submitted.ticketId);
    expect(stored).toMatchObject({ active: false, status: TicketStatus.OPEN });
    expect(events.map((event) => event.action)).toEqual([
      TicketEventAction.SUBMISSION,
      TicketEventAction.DELETE,
    ]);
    expect(events[1]).toMatchObject({
      user: { userId: EMPLOYEE_ID },
      details: { deletedBy: { userId: EMPLOYEE_ID } },
    });
  });

  it('accepts a no-op modification without changing the ticket or history', async () => {
    const submitted = await submitOpenTicket(service);
    const before = await prisma.ticket.findUniqueOrThrow({
      where: { ticketId: submitted.ticketId },
    });

    const result = await service.modify(
      submitted.ticketId,
      { title: submitted.title },
      requestUser(),
    );

    const after = await prisma.ticket.findUniqueOrThrow({
      where: { ticketId: submitted.ticketId },
    });
    expect(result.title).toBe(submitted.title);
    expect(after).toEqual(before);
    expect(await prisma.ticketEvent.count()).toBe(1);
  });

  it('does not append events for rejected lifecycle operations', async () => {
    const submitted = await submitOpenTicket(service);

    await expect(
      service.close(submitted.ticketId, {}, agentUser()),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.modify(
        submitted.ticketId,
        { title: 'Unauthorized change' },
        requestUser({
          userId: EMPLOYEE_2_ID,
          email: 'sam@company.com',
          identityProviderUserId: EMPLOYEE_2_ID,
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.claim(submitted.ticketId, agentUser(AGENT_2_ID)),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.cancel(
        submitted.ticketId,
        requestUser({
          userId: EMPLOYEE_2_ID,
          email: 'sam@company.com',
          identityProviderUserId: EMPLOYEE_2_ID,
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.reopen(submitted.ticketId, {}, requestUser()),
    ).rejects.toThrow(BadRequestException);

    expect(await prisma.ticketEvent.count()).toBe(1);
  });

  it('does not record an event when submission is rejected', async () => {
    await expect(
      service.submit(
        submitDto({ departmentId: 'missing-department' }),
        requestUser(),
      ),
    ).rejects.toThrow(NotFoundException);

    expect(await prisma.ticketEvent.count()).toBe(0);
    expect(await prisma.ticket.count()).toBe(0);
  });

  it('rolls back a claim when appending its event fails', async () => {
    const submitted = await submitOpenTicket(service);
    jest
      .spyOn(eventsRepository, 'append')
      .mockRejectedValueOnce(new Error('simulated event failure'));

    await expect(
      service.claim(submitted.ticketId, agentUser()),
    ).rejects.toThrow(InternalServerErrorException);

    const stored = await prisma.ticket.findUniqueOrThrow({
      where: { ticketId: submitted.ticketId },
    });
    expect(stored.status).toBe(TicketStatus.OPEN);
    expect(stored.agentId).toBeNull();
    expect(await prisma.ticketEvent.count()).toBe(1);
  });

  it('authorizes history and scopes individual event lookup to its ticket', async () => {
    const first = await submitOpenTicket(service);
    const second = await submitOpenTicket(service);
    const firstEvents = await service.findEvents(first.ticketId, requestUser());

    await expect(
      service.findEvents(first.ticketId, agentUser()),
    ).resolves.toHaveLength(1);
    await expect(
      service.findEvents(first.ticketId, adminUser()),
    ).resolves.toHaveLength(1);

    await expect(
      service.findEvents(
        first.ticketId,
        requestUser({
          userId: EMPLOYEE_2_ID,
          email: 'sam@company.com',
          identityProviderUserId: EMPLOYEE_2_ID,
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.findEvent(
        second.ticketId,
        firstEvents[0].ticketEventId,
        requestUser(),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
