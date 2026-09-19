import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { AuthenticationService } from '../authentication/authentication.service';
import { TicketsService } from '../tickets/tickets.service';
import { OperationsGateway } from './operations.gateway';
import { OperationsServerEvent } from './realtime-events';

const actor: AuthenticatedRequestUser = {
  userId: 'user-1',
  email: 'agent@nexus.test',
  fullName: 'Agent One',
  phoneNumber: null,
  role: 'Agent',
  isActive: true,
  hasLogged: true,
  identityProviderId: 'provider-1',
  identityProviderUserId: 'identity-1',
};

function socket(cookie = 'nexus_session=session-1') {
  return {
    id: 'socket-1',
    handshake: { headers: { cookie } },
    data: {},
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
}

describe('OperationsGateway', () => {
  let authenticationService: {
    authenticateSession: jest.MockedFunction<
      AuthenticationService['authenticateSession']
    >;
  };
  let ticketsService: {
    findOne: jest.MockedFunction<TicketsService['findOne']>;
  };
  let gateway: OperationsGateway;

  beforeEach(() => {
    authenticationService = {
      authenticateSession:
        jest.fn<AuthenticationService['authenticateSession']>(),
    };
    ticketsService = {
      findOne: jest.fn<TicketsService['findOne']>(),
    };
    gateway = new OperationsGateway(
      authenticationService as unknown as AuthenticationService,
      ticketsService as unknown as TicketsService,
    );
  });

  it('authenticates from the session cookie and joins the private user room', async () => {
    authenticationService.authenticateSession.mockResolvedValue(actor);
    const client = socket();

    await gateway.handleConnection(client as never);

    expect(authenticationService.authenticateSession).toHaveBeenCalledWith(
      'session-1',
    );
    expect(client.join).toHaveBeenCalledWith('user:user-1');
    expect(client.emit).toHaveBeenCalledWith(OperationsServerEvent.Connected, {
      userId: 'user-1',
    });
    expect(gateway.isUserOnline('user-1')).toBe(true);
  });

  it('rejects an unauthenticated connection before it joins any room', async () => {
    authenticationService.authenticateSession.mockResolvedValue(null);
    const client = socket();

    await gateway.handleConnection(client as never);

    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith(OperationsServerEvent.Error, {
      code: 'UNAUTHORIZED',
    });
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('authorizes ticket room subscriptions through the ticket visibility service', async () => {
    authenticationService.authenticateSession.mockResolvedValue(actor);
    ticketsService.findOne.mockResolvedValue({} as never);
    const client = socket();
    await gateway.handleConnection(client as never);

    const result = await gateway.joinTicketRoom(
      { ticketId: 'ticket-1' },
      client as never,
    );

    expect(ticketsService.findOne).toHaveBeenCalledWith('ticket-1', actor);
    expect(client.join).toHaveBeenLastCalledWith('ticket:ticket-1');
    expect(result).toEqual({ ok: true });
  });

  it('does not disclose inaccessible tickets through room acknowledgements', async () => {
    authenticationService.authenticateSession.mockResolvedValue(actor);
    ticketsService.findOne.mockRejectedValue(new Error('forbidden'));
    const client = socket();
    await gateway.handleConnection(client as never);

    await expect(
      gateway.joinTicketRoom({ ticketId: 'hidden-ticket' }, client as never),
    ).resolves.toEqual({ ok: false, code: 'TICKET_UNAVAILABLE' });
    expect(client.join).not.toHaveBeenCalledWith('ticket:hidden-ticket');
  });

  it('removes disconnected sockets from presence tracking', async () => {
    authenticationService.authenticateSession.mockResolvedValue(actor);
    const client = socket();
    await gateway.handleConnection(client as never);

    gateway.handleDisconnect(client as never);

    expect(gateway.isUserOnline('user-1')).toBe(false);
  });

  it('fans ticket events out only through that ticket room', () => {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    gateway.server = { to } as never;

    gateway.handleTicketUpdated({
      eventId: 'ticket-event-1',
      occurredAt: '2026-09-19T10:00:00.000Z',
      version: 1,
      ticketId: 'ticket-1',
      actorId: 'agent-1',
      payload: {
        ticketId: 'ticket-1',
        ticketNumber: 'TKT-0001',
        title: 'VPN access',
        status: 'CLAIMED',
        priority: 'HIGH',
        active: true,
        updatedAt: '2026-09-19T10:00:00.000Z',
      },
    });

    expect(to).toHaveBeenCalledWith('ticket:ticket-1');
    expect(emit).toHaveBeenCalledWith('ticket.updated', expect.any(Object));
  });

  it('disconnects only sockets for invalidated sessions', async () => {
    authenticationService.authenticateSession.mockResolvedValue(actor);
    const client = socket();
    await gateway.handleConnection(client as never);
    gateway.server = {
      sockets: { sockets: new Map([[client.id, client]]) },
    } as never;

    gateway.handleSessionInvalidated({
      userId: actor.userId,
      sessionIds: ['session-1'],
      reason: 'LOGOUT',
    });

    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
});
