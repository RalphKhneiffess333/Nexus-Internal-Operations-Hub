import { Prisma, TicketEventAction, TicketStatus } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';
import { TicketEventsRepository } from './events/ticket-events.repository';
import { HandoffsService } from './handoffs/handoffs.service';
import { TicketsRepository } from './repositories/tickets.repository';
import { TicketRealtimePublisher } from './realtime/ticket-realtime.publisher';
import { TicketAssignmentReconciliationService } from './ticket-assignment-reconciliation.service';

describe('TicketAssignmentReconciliationService', () => {
  it('cancels active submitted and assigned tickets when a user is deactivated', async () => {
    const tx = {} as Prisma.TransactionClient;
    const submittedOpen = {
      ticketId: 'submitted-open',
      submittedBy: 'user-1',
      agentId: null,
      active: true,
      status: TicketStatus.OPEN,
      completionNotes: null,
    };
    const submittedClaimed = {
      ticketId: 'submitted-claimed',
      submittedBy: 'user-1',
      agentId: 'agent-2',
      active: true,
      status: TicketStatus.CLAIMED,
      completionNotes: null,
    };
    const assignedClaimed = {
      ticketId: 'assigned-claimed',
      submittedBy: 'user-2',
      agentId: 'user-1',
      active: true,
      status: TicketStatus.CLAIMED,
      completionNotes: null,
    };
    const ticketsById = new Map([
      [submittedOpen.ticketId, submittedOpen],
      [submittedClaimed.ticketId, submittedClaimed],
      [assignedClaimed.ticketId, assignedClaimed],
    ]);
    const tickets = {
      findActiveSubmittedOrClaimedByUser: jest
        .fn()
        .mockResolvedValue(
          [...ticketsById.values()].map(({ ticketId }) => ({ ticketId })),
        ),
      findByIdForUpdate: jest
        .fn()
        .mockImplementation((ticketId) =>
          Promise.resolve(ticketsById.get(ticketId)),
        ),
      save: jest.fn().mockImplementation((ticket) => Promise.resolve(ticket)),
    } as unknown as TicketsRepository;
    const append = jest
      .fn()
      .mockResolvedValueOnce('event-1')
      .mockResolvedValueOnce('event-2')
      .mockResolvedValueOnce('event-3');
    const cancelPendingForTicket = jest.fn().mockResolvedValue(undefined);
    const service = new TicketAssignmentReconciliationService(
      tickets,
      { append } as unknown as TicketEventsRepository,
      { cancelPendingForTicket } as unknown as HandoffsService,
      {} as TicketRealtimePublisher,
    );

    await service.cancelTicketsForDeactivatedUser('user-1', 'admin-1', tx);

    expect(ticketsById.get(submittedOpen.ticketId)).toMatchObject({
      active: false,
      agentId: null,
      completionNotes: null,
    });
    expect(ticketsById.get(submittedClaimed.ticketId)).toMatchObject({
      active: false,
      agentId: null,
      completionNotes: "The submitter's account has been deactivated.",
    });
    expect(ticketsById.get(assignedClaimed.ticketId)).toMatchObject({
      active: false,
      agentId: null,
      completionNotes: "The assigned agent's account has been deactivated.",
    });
    expect(cancelPendingForTicket).toHaveBeenCalledTimes(3);
    expect(append).toHaveBeenCalledTimes(3);
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: TicketEventAction.DELETE,
        details: { deletedById: 'admin-1' },
      }),
      tx,
    );
  });
});
