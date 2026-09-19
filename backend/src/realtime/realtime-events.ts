export const RealtimeInternalEvent = {
  TicketUpdated: 'realtime.ticket.updated',
  TicketEventCreated: 'realtime.ticket.event-created',
  ChatMessageCreated: 'realtime.chat.message-created',
  SessionInvalidated: 'realtime.session.invalidated',
} as const;

export const OperationsClientEvent = {
  JoinTicketRoom: 'join ticket room',
  LeaveTicketRoom: 'leave ticket room',
  JoinChatRoom: 'join chat room',
  LeaveChatRoom: 'leave chat room',
} as const;

export const OperationsServerEvent = {
  Connected: 'operations.connected',
  Error: 'operations.error',
  TicketUpdated: 'ticket.updated',
  TicketEventCreated: 'ticket.event.created',
  ChatMessageCreated: 'chat.message.created',
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
  active: boolean;
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

export interface ChatMessageCreatedPayload {
  messageId: string;
  ticketId: string;
  content: string | null;
  createdAt: Date;
  updatedAt: Date;
  sender: {
    userId: string;
    fullName: string;
    email: string;
    role: string;
  };
  attachments: Array<{
    attachmentId: string;
    fileId: string;
    originalName: string;
    fileSize: number;
    mimeType: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

export type ChatMessageCreatedRealtimeEvent =
  RealtimeEnvelope<ChatMessageCreatedPayload>;

export interface SessionInvalidatedRealtimeEvent {
  userId: string;
  sessionIds?: string[];
  reason: 'LOGOUT' | 'LOGOUT_ALL_DEVICES' | 'DEACTIVATED' | 'ROLE_CHANGED';
}
