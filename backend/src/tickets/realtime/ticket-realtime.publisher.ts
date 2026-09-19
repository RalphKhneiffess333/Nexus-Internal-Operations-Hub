import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TicketEventAction } from '@prisma/client';
import {
  RealtimeInternalEvent,
  TicketEventCreatedRealtimeEvent,
  TicketUpdatedRealtimeEvent,
} from '../../realtime/realtime-events';
import { TicketRecord } from '../repositories/tickets.repository';

@Injectable()
export class TicketRealtimePublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishMutation(
    ticket: TicketRecord,
    ticketEventId: string,
    actorId: string,
    action: TicketEventAction,
  ): void {
    const occurredAt = ticket.updatedAt.toISOString();
    const version = ticket.updatedAt.getTime();

    const ticketUpdated: TicketUpdatedRealtimeEvent = {
      eventId: ticketEventId,
      occurredAt,
      version,
      ticketId: ticket.ticketId,
      actorId,
      payload: {
        ticketId: ticket.ticketId,
        ticketNumber: ticket.ticketCode,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        updatedAt: occurredAt,
      },
    };
    this.eventEmitter.emit(RealtimeInternalEvent.TicketUpdated, ticketUpdated);
    this.publishTicketEvent(
      ticket.ticketId,
      ticketEventId,
      actorId,
      action,
      occurredAt,
      version,
    );
  }

  publishTicketEvent(
    ticketId: string,
    ticketEventId: string,
    actorId: string,
    action: TicketEventAction,
    occurredAt: string,
    version = new Date(occurredAt).getTime(),
  ): void {
    const ticketEventCreated: TicketEventCreatedRealtimeEvent = {
      eventId: ticketEventId,
      occurredAt,
      version,
      ticketId,
      actorId,
      payload: {
        ticketEventId,
        action,
        createdAt: occurredAt,
      },
    };
    this.eventEmitter.emit(
      RealtimeInternalEvent.TicketEventCreated,
      ticketEventCreated,
    );
  }
}
