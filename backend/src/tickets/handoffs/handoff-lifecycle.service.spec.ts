import { ForbiddenException } from '@nestjs/common';
import { Prisma, TicketStatus, UserRole } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';
import type { AuthenticatedRequestUser } from '../../authentication/request-user';
import { HandoffCancellationService } from './handoff-cancellation.service';
import { HandoffLifecycleService } from './handoff-lifecycle.service';
import { HandoffPolicy } from './handoff.policy';
import { HandoffResponseMapper } from './handoff-response.mapper';
import { HandoffsRepository } from './handoffs.repository';
import { TicketEventsRepository } from '../events/ticket-events.repository';
import { TicketRealtimePublisher } from '../realtime/ticket-realtime.publisher';
import { TicketsRepository } from '../repositories/tickets.repository';
import { NotificationsService } from '../../notifications/notifications.service';
import { EmailNotificationsService } from '../../notifications/email-notifications.service';

describe('HandoffLifecycleService', () => {
  it('validates the authenticated actor and publishes nothing after rejection', async () => {
    const actor: AuthenticatedRequestUser = {
      userId: 'unrelated-agent',
      email: 'unrelated@example.com',
      fullName: 'Unrelated Agent',
      phoneNumber: null,
      role: UserRole.Agent,
      isActive: true,
      hasLogged: true,
      identityProviderId: 'entra',
      identityProviderUserId: 'unrelated-agent',
    };
    const existing = { handoffId: 'handoff-1', ticketId: 'ticket-1' };
    const ticket = {
      ticketId: 'ticket-1',
      departmentId: 'dept-1',
      active: true,
      status: TicketStatus.CLAIMED,
      agentId: 'requester-1',
    };
    const requester = {
      userId: 'requester-1',
      fullName: 'Requester',
      role: UserRole.Agent,
      isActive: true,
    };
    const requestedAgent = {
      userId: 'requested-agent',
      fullName: 'Requested Agent',
      role: UserRole.Agent,
      isActive: true,
    };
    const authenticatedActor = {
      ...requester,
      userId: actor.userId,
      fullName: actor.fullName,
    };
    const assertAccept = jest.fn(
      (_: unknown, __: unknown, actualActor: typeof authenticatedActor) => {
        expect(actualActor).toBe(authenticatedActor);
        throw new ForbiddenException(
          'Only the requested agent can accept this handoff',
        );
      },
    );
    const transferClaimed = jest.fn();
    const updateStatus = jest.fn();
    const append = jest.fn();
    const cancelPendingForTicket = jest.fn();
    const publishMutation = jest.fn();
    const publishTicketEvent = jest.fn();
    const notify = jest.fn();
    const notifyHandoffAccepted = jest.fn();
    const repository = {
      findById: jest
        .fn<() => Promise<typeof existing | null>>()
        .mockResolvedValue(existing),
      transaction: jest
        .fn<
          <T>(
            operation: (client: Prisma.TransactionClient) => Promise<T>,
          ) => Promise<T>
        >()
        .mockImplementation((operation) =>
          operation({} as Prisma.TransactionClient),
        ),
      lockTicket: jest
        .fn<() => Promise<typeof ticket | null>>()
        .mockResolvedValue(ticket),
      findByIdForUpdate: jest
        .fn<HandoffsRepository['findByIdForUpdate']>()
        .mockResolvedValue({
          ...existing,
          requesterId: requester.userId,
          requestedAgentId: requestedAgent.userId,
          status: 'PENDING',
          message: null,
        } as never),
      findUser: jest.fn((userId: string) =>
        Promise.resolve(
          userId === requester.userId
            ? requester
            : userId === requestedAgent.userId
              ? requestedAgent
              : authenticatedActor,
        ),
      ),
      isActiveMember: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
      updateStatus,
    } as unknown as HandoffsRepository;
    const service = new HandoffLifecycleService(
      repository,
      { append } as unknown as TicketEventsRepository,
      { transferClaimed, findById: jest.fn() } as unknown as TicketsRepository,
      { assertAccept } as unknown as HandoffPolicy,
      {
        publishMutation,
        publishTicketEvent,
      } as unknown as TicketRealtimePublisher,
      { notify } as unknown as NotificationsService,
      { notifyHandoffAccepted } as unknown as EmailNotificationsService,
      new HandoffResponseMapper(),
      { cancelPendingForTicket } as unknown as HandoffCancellationService,
    );

    await expect(service.accept(existing.handoffId, actor)).rejects.toThrow(
      ForbiddenException,
    );
    expect(assertAccept).toHaveBeenCalledTimes(1);
    expect(transferClaimed).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
    expect(cancelPendingForTicket).not.toHaveBeenCalled();
    expect(publishMutation).not.toHaveBeenCalled();
    expect(publishTicketEvent).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(notifyHandoffAccepted).not.toHaveBeenCalled();
  });
});
