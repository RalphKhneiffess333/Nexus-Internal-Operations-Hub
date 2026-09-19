import { HandoffStatus, TicketStatus, UserRole } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';
import type { AuthenticatedRequestUser } from '../../authentication/request-user';
import { DepartmentsRepository } from '../../departments/repositories/departments.repository';
import { ViewTicketPolicy } from '../policies/view-ticket.policy';
import { TicketsRepository } from '../repositories/tickets.repository';
import { HandoffPolicy } from './handoff.policy';
import { HandoffResponseMapper } from './handoff-response.mapper';
import { HandoffsRepository } from './handoffs.repository';
import { HandoffQueryService } from './handoff-query.service';

describe('HandoffQueryService', () => {
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

  it('rejects inactive tickets before checking handoff visibility', async () => {
    const findById = jest
      .fn<(ticketId: string) => Promise<{ active: boolean } | null>>()
      .mockResolvedValue({ active: false });
    const service = new HandoffQueryService(
      {} as HandoffsRepository,
      { findById } as unknown as TicketsRepository,
      {} as DepartmentsRepository,
      {} as HandoffPolicy,
      { assert: jest.fn() } as unknown as ViewTicketPolicy,
      new HandoffResponseMapper(),
    );

    await expect(service.listForTicket('ticket-1', actor)).rejects.toThrow(
      'Ticket was not found',
    );
    expect(findById).toHaveBeenCalledWith('ticket-1');
  });

  it('enforces requester policy and maps eligible agents', async () => {
    const requester = {
      userId: actor.userId,
      fullName: actor.fullName,
      email: actor.email,
      role: UserRole.Agent,
      isActive: true,
    };
    const agents = [
      {
        userId: 'agent-2',
        fullName: 'Agent Two',
        email: 'agent2@example.com',
        role: UserRole.Agent,
        isActive: true,
      },
    ];
    const assertRequester = jest.fn();
    const service = new HandoffQueryService(
      {
        findUser: jest
          .fn<() => Promise<typeof requester | null>>()
          .mockResolvedValue(requester),
        isActiveMember: jest
          .fn<() => Promise<boolean>>()
          .mockResolvedValue(true),
        findEligibleAgents: jest
          .fn<() => Promise<typeof agents>>()
          .mockResolvedValue(agents),
      } as unknown as HandoffsRepository,
      {
        findById: jest.fn<TicketsRepository['findById']>().mockResolvedValue({
          ticketId: 'ticket-1',
          departmentId: 'dept-1',
          active: true,
          status: TicketStatus.CLAIMED,
          agentId: actor.userId,
        } as never),
      } as unknown as TicketsRepository,
      {} as DepartmentsRepository,
      { assertRequester } as unknown as HandoffPolicy,
      {} as ViewTicketPolicy,
      new HandoffResponseMapper(),
    );

    await expect(
      service.listEligibleAgents('ticket-1', actor),
    ).resolves.toEqual(agents);
    expect(assertRequester).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: 'ticket-1' }),
      requester,
      true,
    );
  });

  it('passes ticket filters to the repository and maps query results', async () => {
    const handoff = {
      handoffId: 'handoff-1',
      status: HandoffStatus.PENDING,
      message: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      resolvedAt: null,
      requester: {
        userId: 'requester-1',
        fullName: 'Requester',
        email: 'requester@example.com',
        role: UserRole.Agent,
        isActive: true,
      },
      requestedAgent: {
        userId: 'agent-2',
        fullName: 'Agent Two',
        email: 'agent2@example.com',
        role: UserRole.Agent,
        isActive: true,
      },
      ticket: {
        ticketId: 'ticket-1',
        ticketCode: 'TCK-1',
        title: 'Ticket',
        status: TicketStatus.CLAIMED,
        active: true,
        agentId: 'requester-1',
        departmentId: 'dept-1',
        department: { departmentId: 'dept-1', code: 'IT', name: 'IT' },
        agent: null,
      },
    };
    const findForActor = jest
      .fn<HandoffsRepository['findForActor']>()
      .mockResolvedValue([handoff] as never);
    const service = new HandoffQueryService(
      { findForActor } as unknown as HandoffsRepository,
      {} as TicketsRepository,
      {} as DepartmentsRepository,
      {} as HandoffPolicy,
      {} as ViewTicketPolicy,
      new HandoffResponseMapper(),
    );
    const query = { status: HandoffStatus.PENDING };

    const result = await service.list(actor, 'outgoing', query);

    expect(findForActor).toHaveBeenCalledWith(actor.userId, 'outgoing', query);
    expect(result[0]).toMatchObject({ handoffId: 'handoff-1' });
  });
});
