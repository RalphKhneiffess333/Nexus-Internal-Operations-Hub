import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { describe, beforeEach, expect, it, jest } from '@jest/globals';
import type { AuthenticatedRequestUser } from '../../authentication/request-user';
import { PrioritiesService } from '../../priorities/priorities.service';
import { TicketsService } from '../../tickets/tickets.service';
import {
  GET_TICKET_BY_NUMBER,
  ToolRegistryService,
} from './tool-registry.service';

describe('ToolRegistryService', () => {
  let priorities: jest.Mocked<Pick<PrioritiesService, 'findByCode'>>;
  let tickets: jest.Mocked<
    Pick<TicketsService, 'findOneByCode' | 'findEvents'>
  >;
  let service: ToolRegistryService;

  const actor: AuthenticatedRequestUser = {
    userId: 'user-1',
    email: 'employee@example.com',
    fullName: 'Employee One',
    phoneNumber: null,
    role: UserRole.Employee,
    isActive: true,
    hasLogged: true,
    identityProviderId: 'idp-1',
    identityProviderUserId: 'external-user-1',
  };

  beforeEach(() => {
    priorities = {
      findByCode: jest.fn<PrioritiesService['findByCode']>(),
    };
    tickets = {
      findOneByCode: jest.fn<TicketsService['findOneByCode']>(),
      findEvents: jest.fn<TicketsService['findEvents']>(),
    };
    service = new ToolRegistryService(
      priorities as unknown as PrioritiesService,
      tickets as unknown as TicketsService,
    );
  });

  it('exposes only the bounded registered tools', () => {
    expect(
      service
        .definitions({
          includeTicketByNumber: true,
        })
        .map((definition) => definition.name),
    ).toEqual([GET_TICKET_BY_NUMBER]);
  });

  it('converts ticket authorization failures into a non-leaking result', async () => {
    tickets.findOneByCode.mockRejectedValue(new ForbiddenException());

    await expect(
      service.execute(
        GET_TICKET_BY_NUMBER,
        { ticketNumber: 'TKT-0042' },
        actor,
      ),
    ).resolves.toEqual({
      accessible: false,
      message:
        "I couldn't access that ticket. Check the ticket number or your permissions.",
    });

    expect(tickets.findEvents).not.toHaveBeenCalled();
  });

  it('rejects unsupported ticket lookup shapes without querying tickets', async () => {
    await expect(
      service.execute(
        GET_TICKET_BY_NUMBER,
        { status: 'OPEN', limit: 50 },
        actor,
      ),
    ).resolves.toEqual({
      accessible: false,
      message:
        'I could not process that ticket number. Please provide one ticket number such as TKT-0042.',
    });

    expect(tickets.findOneByCode).not.toHaveBeenCalled();
  });
});
