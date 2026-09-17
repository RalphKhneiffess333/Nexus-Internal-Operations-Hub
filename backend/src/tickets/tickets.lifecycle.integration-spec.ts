import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, beforeEach, afterEach, expect, it } from '@jest/globals';
import { Ticket, TicketStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TicketsService } from './tickets.service';
import {
  AGENT_ID,
  EMPLOYEE_2_ID,
  agentUser,
  claimTicket,
  closeTicket,
  createTicketsTestingModule,
  requestUser,
  submitOpenTicket,
} from './tickets.test-utils';

describe('Ticket lifecycle integration', () => {
  let service: TicketsService;
  let prisma: PrismaService;
  let moduleRef: Awaited<ReturnType<typeof createTicketsTestingModule>>;

  beforeEach(async () => {
    moduleRef = await createTicketsTestingModule();
    service = moduleRef.get(TicketsService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('follows OPEN -> CLAIMED -> CLOSED -> REOPENED -> CLAIMED', async () => {
    const open = await submitOpenTicket(service);
    expect(open.status).toBe(TicketStatus.OPEN);
    expect(open.agent).toBeNull();

    const claimed = await claimTicket(service, open.ticketId);
    expect(claimed.status).toBe(TicketStatus.CLAIMED);
    expect(claimed.agent?.userId).toBe(AGENT_ID);

    const closed = await closeTicket(service, claimed.ticketId);
    expect(closed.status).toBe(TicketStatus.CLOSED);
    expect(closed.agent).toBeNull();
    expect(closed.completionNotes).toBe('Replaced the power adapter');
    expect(closed.closedAt).toBeInstanceOf(Date);

    const reopened = await service.reopen(
      closed.ticketId,
      {
        description: 'The issue came back after a day',
      },
      requestUser(),
    );
    expect(reopened.status).toBe(TicketStatus.REOPENED);
    expect(reopened.agent).toBeNull();
    expect(reopened.description).toBe('The issue came back after a day');

    const claimedAgain = await claimTicket(service, reopened.ticketId);
    expect(claimedAgain.status).toBe(TicketStatus.CLAIMED);
    expect(claimedAgain.agent?.userId).toBe(AGENT_ID);
  });

  it('keeps the persisted ticket unchanged when a duplicate claim is rejected', async () => {
    const open = await submitOpenTicket(service);
    await claimTicket(service, open.ticketId);
    const before = await persistedTicket(open.ticketId);

    await expect(
      service.claim(open.ticketId, agentUser(AGENT_ID)),
    ).rejects.toThrow(BadRequestException);

    const after = await persistedTicket(open.ticketId);
    expectUnchanged(after, before);
    expect(after.status).toBe(TicketStatus.CLAIMED);
    expect(after.agentId).toBe(AGENT_ID);
  });

  it('keeps the persisted ticket unchanged when reopening by a non-submitter is rejected', async () => {
    const open = await submitOpenTicket(service);
    await claimTicket(service, open.ticketId);
    await closeTicket(service, open.ticketId);
    const before = await persistedTicket(open.ticketId);

    await expect(
      service.reopen(
        open.ticketId,
        { description: 'Trying to rewrite the ticket' },
        requestUser({
          userId: EMPLOYEE_2_ID,
          email: 'sam@company.com',
          identityProviderUserId: EMPLOYEE_2_ID,
        }),
      ),
    ).rejects.toThrow(ForbiddenException);

    const after = await persistedTicket(open.ticketId);
    expectUnchanged(after, before);
    expect(after.status).toBe(TicketStatus.CLOSED);
    expect(after.agentId).toBeNull();
    expect(after.completionNotes).toBe('Replaced the power adapter');
  });

  async function persistedTicket(ticketId: string): Promise<Ticket> {
    const ticket = await prisma.ticket.findUnique({ where: { ticketId } });

    if (!ticket) {
      throw new Error(`Expected ticket ${ticketId} to exist`);
    }

    return ticket;
  }

  function expectUnchanged(actual: Ticket, expected: Ticket): void {
    expect(actual).toEqual({
      ...expected,
      createdAt: expected.createdAt,
      updatedAt: expected.updatedAt,
      closedAt: expected.closedAt,
    });
  }
});
