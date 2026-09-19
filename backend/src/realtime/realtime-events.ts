export const RealtimeInternalEvent = {
  TicketUpdated: 'realtime.ticket.updated',
  TicketEventCreated: 'realtime.ticket.event-created',
  SessionInvalidated: 'realtime.session.invalidated',
} as const;

export const OperationsClientEvent = {
  JoinTicketRoom: 'join ticket room',
  LeaveTicketRoom: 'leave ticket room',
} as const;

export const OperationsServerEvent = {
  Connected: 'operations.connected',
  Error: 'operations.error',
  TicketUpdated: 'ticket.updated',
  TicketEventCreated: 'ticket.event.created',
} as const;

export interface RealtimeEnvelope<TPayload> {
  eventId: string;
  occurredAt: string;
  version: number;
  ticketId: string;
  actorId: string;
  payload: TPayload;
}

export interface TicketUpdatedPayload {
  ticketId: string;
  ticketNumber: string;
  title: string;
  status: string;
  priority: string;
  updatedAt: string;
}

export type TicketUpdatedRealtimeEvent = RealtimeEnvelope<TicketUpdatedPayload>;

export interface TicketEventCreatedPayload {
  ticketEventId: string;
  action: string;
  createdAt: string;
}

export type TicketEventCreatedRealtimeEvent =
  RealtimeEnvelope<TicketEventCreatedPayload>;

export interface SessionInvalidatedRealtimeEvent {
  userId: string;
  sessionIds?: string[];
  reason: 'LOGOUT' | 'LOGOUT_ALL_DEVICES' | 'DEACTIVATED' | 'ROLE_CHANGED';
}
