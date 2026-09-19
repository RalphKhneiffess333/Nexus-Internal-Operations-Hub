import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AuthenticationService } from '../authentication/authentication.service';
import { SESSION_COOKIE_NAME } from '../authentication/authentication.constants';
import { parseCookieHeader } from '../authentication/cookies';
import { TicketsService } from '../tickets/tickets.service';
import {
  OperationsClientEvent,
  OperationsServerEvent,
} from './realtime-events';
import { ticketRoom, userRoom } from './realtime-rooms';

interface OperationsSocketData {
  sessionId?: string;
  userId?: string;
  joinedTicketIds?: Set<string>;
}

interface TicketRoomRequest {
  ticketId?: unknown;
}

interface RoomAcknowledgement {
  ok: boolean;
  code?: 'UNAUTHORIZED' | 'INVALID_TICKET' | 'TICKET_UNAVAILABLE';
}

function allowedOrigins(): string | string[] {
  const origins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
}

@WebSocketGateway({
  namespace: 'operations',
  cors: {
    origin: allowedOrigins(),
    credentials: true,
  },
})
export class OperationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(OperationsGateway.name);
  private readonly socketsById = new Map<
    string,
    { userId: string; sessionId: string }
  >();
  private readonly socketIdsByUserId = new Map<string, Set<string>>();

  constructor(
    private readonly authenticationService: AuthenticationService,
    private readonly ticketsService: TicketsService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const sessionId = parseCookieHeader(client.handshake.headers.cookie)[
      SESSION_COOKIE_NAME
    ];
    const user =
      await this.authenticationService.authenticateSession(sessionId);
    if (!user || !sessionId) {
      client.emit(OperationsServerEvent.Error, { code: 'UNAUTHORIZED' });
      client.disconnect(true);
      return;
    }

    const data = client.data as OperationsSocketData;
    data.sessionId = sessionId;
    data.userId = user.userId;
    data.joinedTicketIds = new Set<string>();
    this.trackSocket(client.id, user.userId, sessionId);
    await client.join(userRoom(user.userId));
    client.emit(OperationsServerEvent.Connected, { userId: user.userId });
  }

  handleDisconnect(client: Socket): void {
    const record = this.socketsById.get(client.id);
    if (!record) {
      return;
    }

    this.socketsById.delete(client.id);
    const socketIds = this.socketIdsByUserId.get(record.userId);
    socketIds?.delete(client.id);
    if (!socketIds?.size) {
      this.socketIdsByUserId.delete(record.userId);
    }
  }

  @SubscribeMessage(OperationsClientEvent.JoinTicketRoom)
  async joinTicketRoom(
    @MessageBody() body: TicketRoomRequest,
    @ConnectedSocket() client: Socket,
  ): Promise<RoomAcknowledgement> {
    const ticketId =
      typeof body?.ticketId === 'string' ? body.ticketId.trim() : '';
    if (!ticketId) {
      return { ok: false, code: 'INVALID_TICKET' };
    }

    const user = await this.authenticatePacket(client);
    if (!user) {
      return { ok: false, code: 'UNAUTHORIZED' };
    }

    try {
      await this.ticketsService.findOne(ticketId, user);
    } catch {
      // Never reveal whether an inaccessible ticket exists.
      return { ok: false, code: 'TICKET_UNAVAILABLE' };
    }

    await client.join(ticketRoom(ticketId));
    (client.data as OperationsSocketData).joinedTicketIds?.add(ticketId);
    return { ok: true };
  }

  @SubscribeMessage(OperationsClientEvent.LeaveTicketRoom)
  async leaveTicketRoom(
    @MessageBody() body: TicketRoomRequest,
    @ConnectedSocket() client: Socket,
  ): Promise<RoomAcknowledgement> {
    const ticketId =
      typeof body?.ticketId === 'string' ? body.ticketId.trim() : '';
    if (!ticketId) {
      return { ok: false, code: 'INVALID_TICKET' };
    }

    await client.leave(ticketRoom(ticketId));
    (client.data as OperationsSocketData).joinedTicketIds?.delete(ticketId);
    return { ok: true };
  }

  isUserOnline(userId: string): boolean {
    return Boolean(this.socketIdsByUserId.get(userId)?.size);
  }

  disconnectUser(userId: string): void {
    for (const socketId of this.socketIdsByUserId.get(userId) ?? []) {
      this.server.sockets.sockets.get(socketId)?.disconnect(true);
    }
  }

  private async authenticatePacket(client: Socket) {
    const data = client.data as OperationsSocketData;
    const user = await this.authenticationService.authenticateSession(
      data.sessionId,
    );
    if (user) {
      return user;
    }

    client.emit(OperationsServerEvent.Error, { code: 'UNAUTHORIZED' });
    client.disconnect(true);
    return null;
  }

  private trackSocket(
    socketId: string,
    userId: string,
    sessionId: string,
  ): void {
    this.socketsById.set(socketId, { userId, sessionId });
    const socketIds = this.socketIdsByUserId.get(userId) ?? new Set<string>();
    socketIds.add(socketId);
    this.socketIdsByUserId.set(userId, socketIds);
    this.logger.debug(`Socket ${socketId} connected for user ${userId}`);
  }
}
