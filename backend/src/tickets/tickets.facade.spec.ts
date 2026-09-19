import { TicketPriority, TicketStatus, UserRole } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { TicketLifecycleService } from './ticket-lifecycle.service';
import { TicketQueryService } from './ticket-query.service';
import { TicketsService } from './tickets.service';

describe('TicketsService façade', () => {
  const actor: AuthenticatedRequestUser = {
    userId: 'user-employee-1',
    email: 'alex@company.com',
    fullName: 'Alex Employee',
    phoneNumber: null,
    role: UserRole.Employee,
    isActive: true,
    hasLogged: true,
    identityProviderId: 'idp-entra',
    identityProviderUserId: 'user-employee-1',
  };

  it('delegates reads without changing their arguments or result', async () => {
    const result = [
      {
        ticketId: 'ticket-1',
        status: TicketStatus.OPEN,
        priority: TicketPriority.HIGH,
      },
    ];
    const findAll = jest
      .fn<TicketQueryService['findAll']>()
      .mockResolvedValue(result as never);
    const query = { findAll } as unknown as TicketQueryService;
    const lifecycle = {} as TicketLifecycleService;
    const service = new TicketsService(query, lifecycle);
    const filters = { status: TicketStatus.OPEN };

    await expect(service.findAll(actor, filters)).resolves.toBe(result);
    expect(findAll.mock.calls).toContainEqual([actor, filters]);
  });

  it('delegates lifecycle commands without exposing child services to consumers', async () => {
    const result = { ticketId: 'ticket-1' };
    const close = jest
      .fn<TicketLifecycleService['close']>()
      .mockResolvedValue(result as never);
    const lifecycle = { close } as unknown as TicketLifecycleService;
    const query = {} as TicketQueryService;
    const service = new TicketsService(query, lifecycle);
    const dto = { completionNotes: 'Completed' };

    await expect(service.close('ticket-1', dto, actor)).resolves.toBe(result);
    expect(close.mock.calls).toContainEqual([
      'ticket-1',
      dto,
      actor,
      undefined,
    ]);
  });
});
