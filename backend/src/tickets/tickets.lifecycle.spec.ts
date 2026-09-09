import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, beforeEach, afterEach, expect, it } from '@jest/globals';
import { TicketStatus } from '@prisma/client';
import { TicketsService } from './tickets.service';
import {
  AGENT_ID,
  claimTicket,
  closeTicket,
  createTicketsTestingModule,
  submitOpenTicket,
} from './tickets.test-utils';

describe('Ticket lifecycle', () => {
  let service: TicketsService;
  let moduleRef: Awaited<ReturnType<typeof createTicketsTestingModule>>;

  beforeEach(async () => {
    moduleRef = await createTicketsTestingModule();
    service = moduleRef.get(TicketsService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('follows OPEN -> CLAIMED -> CLOSED -> REOPENED -> CLAIMED', async () => {
    const open = await submitOpenTicket(service);
    expect(open.status).toBe(TicketStatus.OPEN);
    expect(open.agentId).toBeNull();

    const claimed = await claimTicket(service, open.ticketId);
    expect(claimed.status).toBe(TicketStatus.CLAIMED);
    expect(claimed.agentId).toBe(AGENT_ID);

    const closed = await closeTicket(service, claimed.ticketId);
    expect(closed.status).toBe(TicketStatus.CLOSED);
    expect(closed.agentId).toBeNull();
    expect(closed.completionNotes).toBe('Replaced the power adapter');
    expect(closed.closedAt).toBeInstanceOf(Date);

    const reopened = await service.reopen(closed.ticketId, {
      description: 'The issue came back after a day',
    });
    expect(reopened.status).toBe(TicketStatus.REOPENED);
    expect(reopened.agentId).toBeNull();
    expect(reopened.description).toBe('The issue came back after a day');

    const claimedAgain = await claimTicket(service, reopened.ticketId);
    expect(claimedAgain.status).toBe(TicketStatus.CLAIMED);
    expect(claimedAgain.agentId).toBe(AGENT_ID);
  });

  it('rejects claiming an already claimed ticket', async () => {
    const open = await submitOpenTicket(service);
    await claimTicket(service, open.ticketId);

    await expect(
      service.claim(open.ticketId, { agentId: 'user-agent-2' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects closing an unclaimed ticket', async () => {
    const open = await submitOpenTicket(service);

    await expect(service.close(open.ticketId, {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects reopening a ticket that is not closed', async () => {
    const open = await submitOpenTicket(service);
    await expect(service.reopen(open.ticketId, {})).rejects.toThrow(
      BadRequestException,
    );

    await claimTicket(service, open.ticketId);
    await expect(service.reopen(open.ticketId, {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects OPEN -> CLOSED and OPEN -> REOPENED', async () => {
    const open = await submitOpenTicket(service);

    await expect(service.close(open.ticketId, {})).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.reopen(open.ticketId, {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects CLOSED -> CLAIMED and CLOSED -> CLOSED', async () => {
    const open = await submitOpenTicket(service);
    await claimTicket(service, open.ticketId);
    await closeTicket(service, open.ticketId);

    await expect(
      service.claim(open.ticketId, { agentId: AGENT_ID }),
    ).rejects.toThrow(BadRequestException);
    await expect(service.close(open.ticketId, {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects CLAIMED -> CLAIMED', async () => {
    const open = await submitOpenTicket(service);
    await claimTicket(service, open.ticketId);

    await expect(
      service.claim(open.ticketId, { agentId: AGENT_ID }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects modifying or cancelling a ticket that is not OPEN', async () => {
    const open = await submitOpenTicket(service);
    await claimTicket(service, open.ticketId);

    await expect(
      service.modify(open.ticketId, { title: 'New title' }),
    ).rejects.toThrow(BadRequestException);
    await expect(service.cancel(open.ticketId)).rejects.toThrow(
      BadRequestException,
    );

    await closeTicket(service, open.ticketId);
    await expect(
      service.modify(open.ticketId, { title: 'New title' }),
    ).rejects.toThrow(BadRequestException);
    await expect(service.cancel(open.ticketId)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects claiming with an unknown agent', async () => {
    const open = await submitOpenTicket(service);

    await expect(
      service.claim(open.ticketId, { agentId: 'missing-agent' }),
    ).rejects.toThrow(NotFoundException);
  });
});
