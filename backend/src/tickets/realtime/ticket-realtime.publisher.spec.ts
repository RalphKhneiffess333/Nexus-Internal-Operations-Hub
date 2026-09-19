import { describe, expect, it, jest } from '@jest/globals';
import {
  TicketEventAction,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RealtimeInternalEvent } from '../../realtime/realtime-events';
import { TicketRealtimePublisher } from './ticket-realtime.publisher';

describe('TicketRealtimePublisher', () => {
  it('publishes stable ticket and event envelopes after a mutation', () => {
    const emit = jest.fn();
    const eventEmitter = { emit } as unknown as EventEmitter2;
    const publisher = new TicketRealtimePublisher(eventEmitter);
    const updatedAt = new Date('2026-09-19T10:00:00.000Z');

    publisher.publishMutation(
      {
        ticketId: 'ticket-1',
        ticketCode: 'TKT-0001',
        title: 'VPN access',
        description: 'Need VPN access',
        priority: TicketPriority.HIGH,
        status: TicketStatus.CLAIMED,
        departmentId: 'department-1',
        submittedBy: 'user-1',
        agentId: 'agent-1',
        active: true,
        completionNotes: null,
        createdAt: updatedAt,
        updatedAt,
        closedAt: null,
        unclaimedSince: null,
        lastReminderAt: null,
        submitter: { fullName: 'Requester', email: 'requester@nexus.test' },
        agent: { fullName: 'Agent', email: 'agent@nexus.test' },
      },
      'ticket-event-1',
      'agent-1',
      TicketEventAction.CLAIM,
    );

    expect(emit).toHaveBeenCalledWith(
      RealtimeInternalEvent.TicketUpdated,
      expect.objectContaining({
        eventId: 'ticket-event-1',
        ticketId: 'ticket-1',
        actorId: 'agent-1',
        payload: expect.objectContaining({
          ticketNumber: 'TKT-0001',
          active: true,
        }),
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      RealtimeInternalEvent.TicketEventCreated,
      expect.objectContaining({
        eventId: 'ticket-event-1',
        payload: {
          ticketEventId: 'ticket-event-1',
          action: 'CLAIM',
          createdAt: updatedAt.toISOString(),
        },
      }),
    );
  });
});
