import { UserRole } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';
import type { AuthenticatedRequestUser } from '../../authentication/request-user';
import { HandoffCancellationService } from './handoff-cancellation.service';
import { HandoffLifecycleService } from './handoff-lifecycle.service';
import { HandoffQueryService } from './handoff-query.service';
import { HandoffsService } from './handoffs.service';

describe('HandoffsService façade', () => {
  const actor: AuthenticatedRequestUser = {
    userId: 'agent-1',
    email: 'agent@example.com',
    fullName: 'Agent One',
    phoneNumber: null,
    role: UserRole.Agent,
    isActive: true,
    hasLogged: true,
    identityProviderId: 'entra',
    identityProviderUserId: 'agent-1',
  };

  it('delegates query and lifecycle calls without changing arguments or results', async () => {
    const handoff = { handoffId: 'handoff-1' };
    const handoffs = {
      items: [handoff],
      page: 1,
      pageSize: 25,
      hasMore: false,
      pendingCount: 0,
    };
    const list = jest
      .fn<HandoffQueryService['list']>()
      .mockResolvedValue(handoffs as never);
    const create = jest
      .fn<HandoffLifecycleService['create']>()
      .mockResolvedValue(handoff as never);
    const query = { list } as unknown as HandoffQueryService;
    const lifecycle = { create } as unknown as HandoffLifecycleService;
    const cancellation = {} as HandoffCancellationService;
    const service = new HandoffsService(query, lifecycle, cancellation);
    const filters = { search: 'ticket' };
    const dto = { requestedAgentId: 'agent-2' };

    await expect(service.list(actor, 'incoming', filters)).resolves.toBe(
      handoffs,
    );
    await expect(service.create('ticket-1', dto, actor)).resolves.toBe(handoff);
    expect(list).toHaveBeenCalledWith(actor, 'incoming', filters);
    expect(create).toHaveBeenCalledWith('ticket-1', dto, actor);
  });

  it('delegates cancellation helpers to the cancellation boundary', async () => {
    const cancelPendingForUser = jest
      .fn<HandoffCancellationService['cancelPendingForUser']>()
      .mockResolvedValue(undefined);
    const cancellation = {
      cancelPendingForUser,
    } as unknown as HandoffCancellationService;
    const service = new HandoffsService(
      {} as HandoffQueryService,
      {} as HandoffLifecycleService,
      cancellation,
    );
    const client = {} as never;

    await service.cancelPendingForUser('user-1', 'admin-1', client);

    expect(cancelPendingForUser).toHaveBeenCalledWith(
      'user-1',
      'admin-1',
      client,
    );
  });
});
