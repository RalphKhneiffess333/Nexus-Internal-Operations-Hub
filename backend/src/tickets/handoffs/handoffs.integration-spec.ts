import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { describe, beforeEach, afterEach, expect, it } from '@jest/globals';
import { HandoffStatus, TicketEventAction, TicketStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  ADMIN_ID,
  AGENT_2_ID,
  AGENT_ID,
  IT_AGENT_2_ID,
  IT_DEPARTMENT_ID,
  agentUser,
  claimTicket,
  closeTicket,
  createTicketsTestingModule,
  submitOpenTicket,
} from '../tickets.test-utils';
import { HandoffsService } from './handoffs.service';
import { TicketsService } from '../tickets.service';

describe('Ticket handoffs integration', () => {
  let moduleRef: Awaited<ReturnType<typeof createTicketsTestingModule>>;
  let prisma: PrismaService;
  let ticketsService: TicketsService;
  let handoffsService: HandoffsService;

  beforeEach(async () => {
    moduleRef = await createTicketsTestingModule();
    prisma = moduleRef.get(PrismaService);
    ticketsService = moduleRef.get(TicketsService);
    handoffsService = moduleRef.get(HandoffsService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('creates a pending request and a REQUESTED event without changing ownership', async () => {
    const ticket = await claimedTicket();

    const handoff = await handoffsService.create(
      ticket.ticketId,
      { requestedAgentId: IT_AGENT_2_ID, message: 'I am going on leave.' },
      agentUser(AGENT_ID),
    );

    expect(handoff).toMatchObject({
      status: HandoffStatus.PENDING,
      message: 'I am going on leave.',
      requester: { userId: AGENT_ID },
      requestedAgent: { userId: IT_AGENT_2_ID },
      ticket: { currentAgent: { userId: AGENT_ID } },
    });
    expect(await persistedTicket(ticket.ticketId)).toMatchObject({
      status: TicketStatus.CLAIMED,
      agentId: AGENT_ID,
    });
    await expect(
      ticketsService.findEvents(ticket.ticketId, agentUser(AGENT_ID)),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: TicketEventAction.HANDOFF,
          details: expect.objectContaining({
            action: 'REQUESTED',
            requester: expect.objectContaining({ userId: AGENT_ID }),
            requestedAgent: expect.objectContaining({ userId: IT_AGENT_2_ID }),
            message: 'I am going on leave.',
          }),
        }),
      ]),
    );
  });

  it('accepts a pending request and transfers ownership atomically', async () => {
    const ticket = await claimedTicket();
    const handoff = await handoffsService.create(
      ticket.ticketId,
      { requestedAgentId: IT_AGENT_2_ID },
      agentUser(AGENT_ID),
    );

    const accepted = await handoffsService.accept(
      handoff.handoffId,
      agentUser(IT_AGENT_2_ID),
    );

    expect(accepted.status).toBe(HandoffStatus.ACCEPTED);
    expect(await persistedTicket(ticket.ticketId)).toMatchObject({
      status: TicketStatus.CLAIMED,
      agentId: IT_AGENT_2_ID,
    });
    const events = await ticketsService.findEvents(
      ticket.ticketId,
      agentUser(IT_AGENT_2_ID),
    );
    expect(
      events.filter((event) => event.action === TicketEventAction.HANDOFF),
    ).toHaveLength(2);
    expect(events.at(-1)).toMatchObject({
      details: {
        action: 'ACCEPTED',
        requestedAgent: { userId: IT_AGENT_2_ID },
      },
    });
  });

  it("does not let an unrelated agent accept another agent's handoff", async () => {
    const ticket = await claimedTicket();
    const handoff = await handoffsService.create(
      ticket.ticketId,
      { requestedAgentId: IT_AGENT_2_ID },
      agentUser(AGENT_ID),
    );

    await expect(
      handoffsService.accept(handoff.handoffId, agentUser(ADMIN_ID)),
    ).rejects.toThrow(ForbiddenException);
    expect(await persistedTicket(ticket.ticketId)).toMatchObject({
      status: TicketStatus.CLAIMED,
      agentId: AGENT_ID,
    });
    expect(
      await prisma.handoffRequest.findUnique({
        where: { handoffId: handoff.handoffId },
      }),
    ).toMatchObject({ status: HandoffStatus.PENDING });
  });

  it('rejects and cancels without changing the current agent', async () => {
    const rejectedTicket = await claimedTicket();
    const rejected = await handoffsService.create(
      rejectedTicket.ticketId,
      { requestedAgentId: IT_AGENT_2_ID },
      agentUser(AGENT_ID),
    );
    await expect(
      handoffsService.reject(rejected.handoffId, agentUser(IT_AGENT_2_ID)),
    ).resolves.toMatchObject({ status: HandoffStatus.REJECTED });
    expect(await persistedTicket(rejectedTicket.ticketId)).toMatchObject({
      agentId: AGENT_ID,
      status: TicketStatus.CLAIMED,
    });

    const cancelledTicket = await claimedTicket();
    const cancelled = await handoffsService.create(
      cancelledTicket.ticketId,
      { requestedAgentId: IT_AGENT_2_ID },
      agentUser(AGENT_ID),
    );
    await expect(
      handoffsService.cancel(cancelled.handoffId, agentUser(AGENT_ID)),
    ).resolves.toMatchObject({ status: HandoffStatus.CANCELLED });
    expect(await persistedTicket(cancelledTicket.ticketId)).toMatchObject({
      agentId: AGENT_ID,
      status: TicketStatus.CLAIMED,
    });
  });

  it('rejects invalid targets and duplicate pending proposals', async () => {
    const ticket = await claimedTicket();
    await expect(
      handoffsService.create(
        ticket.ticketId,
        { requestedAgentId: AGENT_ID },
        agentUser(AGENT_ID),
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      handoffsService.create(
        ticket.ticketId,
        { requestedAgentId: AGENT_2_ID },
        agentUser(AGENT_ID),
      ),
    ).rejects.toThrow(ForbiddenException);

    await handoffsService.create(
      ticket.ticketId,
      { requestedAgentId: IT_AGENT_2_ID },
      agentUser(AGENT_ID),
    );
    await expect(
      handoffsService.create(
        ticket.ticketId,
        { requestedAgentId: IT_AGENT_2_ID },
        agentUser(AGENT_ID),
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('cancels pending requests when a ticket is closed and blocks later acceptance', async () => {
    const ticket = await claimedTicket();
    const handoff = await handoffsService.create(
      ticket.ticketId,
      { requestedAgentId: IT_AGENT_2_ID },
      agentUser(AGENT_ID),
    );

    await closeTicket(ticketsService, ticket.ticketId, agentUser(AGENT_ID));

    expect(
      await prisma.handoffRequest.findUnique({
        where: { handoffId: handoff.handoffId },
      }),
    ).toMatchObject({
      status: HandoffStatus.CANCELLED,
    });
    await expect(
      handoffsService.accept(handoff.handoffId, agentUser(IT_AGENT_2_ID)),
    ).rejects.toThrow(ConflictException);
    const events = await ticketsService.findEvents(
      ticket.ticketId,
      agentUser(AGENT_ID),
    );
    expect(
      events.filter((event) => event.action === TicketEventAction.HANDOFF),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          details: expect.objectContaining({ action: 'CANCELLED' }),
        }),
      ]),
    );
  });

  it('cancels competing pending requests after one request is accepted', async () => {
    const ticket = await claimedTicket();
    const first = await handoffsService.create(
      ticket.ticketId,
      { requestedAgentId: IT_AGENT_2_ID },
      agentUser(AGENT_ID),
    );
    const second = await handoffsService.create(
      ticket.ticketId,
      { requestedAgentId: ADMIN_ID },
      agentUser(AGENT_ID),
    );

    await handoffsService.accept(first.handoffId, agentUser(IT_AGENT_2_ID));

    expect(
      await prisma.handoffRequest.findUnique({
        where: { handoffId: second.handoffId },
      }),
    ).toMatchObject({
      status: HandoffStatus.CANCELLED,
    });
    expect(await persistedTicket(ticket.ticketId)).toMatchObject({
      agentId: IT_AGENT_2_ID,
    });
  });

  it('filters handoffs by participants, ticket text, department, and status', async () => {
    const matchingTicket = await submitOpenTicket(ticketsService, {
      title: 'VPN access request',
    });
    await claimTicket(
      ticketsService,
      matchingTicket.ticketId,
      agentUser(AGENT_ID),
    );
    await handoffsService.create(
      matchingTicket.ticketId,
      { requestedAgentId: IT_AGENT_2_ID },
      agentUser(AGENT_ID),
    );

    const otherTicket = await claimedTicket();
    await handoffsService.create(
      otherTicket.ticketId,
      { requestedAgentId: ADMIN_ID },
      agentUser(AGENT_ID),
    );

    const outgoing = await handoffsService.list(
      agentUser(AGENT_ID),
      'outgoing',
      {
        requestedAgentId: IT_AGENT_2_ID,
        requesterId: AGENT_ID,
        departmentId: IT_DEPARTMENT_ID,
        search: 'VPN',
        status: HandoffStatus.PENDING,
      },
    );
    expect(outgoing.items).toHaveLength(1);
    expect(outgoing.pendingCount).toBe(1);
    expect(outgoing.items[0]).toMatchObject({
      requester: { userId: AGENT_ID },
      requestedAgent: { userId: IT_AGENT_2_ID },
      ticket: {
        title: 'VPN access request',
        department: { departmentId: IT_DEPARTMENT_ID },
      },
    });

    const incoming = await handoffsService.list(
      agentUser(IT_AGENT_2_ID),
      'incoming',
      {
        requesterId: AGENT_ID,
        search: 'VPN',
      },
    );
    expect(incoming.items).toHaveLength(1);
    expect(incoming.pendingCount).toBe(1);
    expect(incoming.items[0].handoffId).toBe(outgoing.items[0].handoffId);
  });

  async function claimedTicket() {
    const ticket = await submitOpenTicket(ticketsService);
    return claimTicket(ticketsService, ticket.ticketId, agentUser(AGENT_ID));
  }

  async function persistedTicket(ticketId: string) {
    return prisma.ticket.findUniqueOrThrow({ where: { ticketId } });
  }
});
