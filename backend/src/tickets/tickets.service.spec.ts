import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Ticket, TicketPriority, TicketStatus, UserRole } from '@prisma/client';
import {
  EMPLOYEE_2_ID,
  EMPLOYEE_ID,
  AGENT_ID,
  AGENT_2_ID,
  HR_DEPARTMENT_ID,
  IT_DEPARTMENT_ID,
} from '../database/seed';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { DepartmentsRepository } from '../departments/repositories/departments.repository';
import { CancelTicketPolicy } from './policies/cancel-ticket.policy';
import { ClaimTicketPolicy } from './policies/claim-ticket.policy';
import { CloseTicketPolicy } from './policies/close-ticket.policy';
import { ModifyTicketPolicy } from './policies/modify-ticket.policy';
import { ReopenTicketPolicy } from './policies/reopen-ticket.policy';
import { SubmitTicketPolicy } from './policies/submit-ticket.policy';
import { ViewTicketPolicy } from './policies/view-ticket.policy';
import { TicketsRepository } from './repositories/tickets.repository';
import { TicketsService } from './tickets.service';

describe('TicketsService invalid transitions', () => {
  let service: TicketsService;
  let ticketsRepository: {
    findById: jest.MockedFunction<TicketsRepository['findById']>;
    claimIfAvailable: jest.MockedFunction<
      TicketsRepository['claimIfAvailable']
    >;
    save: jest.MockedFunction<TicketsRepository['save']>;
  };
  let departmentsRepository: {
    findById: jest.MockedFunction<DepartmentsRepository['findById']>;
    findActiveDepartmentIdsByUserId: jest.MockedFunction<
      DepartmentsRepository['findActiveDepartmentIdsByUserId']
    >;
  };

  beforeEach(() => {
    ticketsRepository = {
      findById: jest.fn<TicketsRepository['findById']>(),
      claimIfAvailable: jest.fn<TicketsRepository['claimIfAvailable']>(),
      save: jest.fn<TicketsRepository['save']>(),
    };
    departmentsRepository = {
      findById: jest.fn<DepartmentsRepository['findById']>(),
      findActiveDepartmentIdsByUserId: jest
        .fn<DepartmentsRepository['findActiveDepartmentIdsByUserId']>()
        .mockResolvedValue([IT_DEPARTMENT_ID]),
    };

    service = new TicketsService(
      ticketsRepository as unknown as TicketsRepository,
      departmentsRepository as unknown as DepartmentsRepository,
      new SubmitTicketPolicy(),
      new ClaimTicketPolicy(),
      new CloseTicketPolicy(),
      new ReopenTicketPolicy(),
      new ModifyTicketPolicy(),
      new CancelTicketPolicy(),
      new ViewTicketPolicy(),
    );
  });

  it('rejects claiming an already claimed ticket without calling the claim write path', async () => {
    const existing = ticket({
      status: TicketStatus.CLAIMED,
      agentId: AGENT_ID,
    });
    ticketsRepository.findById.mockResolvedValue(existing);

    await expect(
      service.claim(existing.ticketId, agentUser(AGENT_ID)),
    ).rejects.toThrow(BadRequestException);

    expect(ticketsRepository.claimIfAvailable).not.toHaveBeenCalled();
    expect(ticketsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects closing an unclaimed ticket without saving', async () => {
    const existing = ticket({ status: TicketStatus.OPEN, agentId: null });
    ticketsRepository.findById.mockResolvedValue(existing);

    await expect(
      service.close(existing.ticketId, {}, agentUser()),
    ).rejects.toThrow(BadRequestException);

    expect(ticketsRepository.save).not.toHaveBeenCalled();
  });

  it.each([TicketStatus.OPEN, TicketStatus.CLAIMED, TicketStatus.REOPENED])(
    'rejects reopening a %s ticket without saving',
    async (status) => {
      const existing = ticket({
        status,
        agentId: status === TicketStatus.CLAIMED ? AGENT_ID : null,
      });
      ticketsRepository.findById.mockResolvedValue(existing);

      await expect(
        service.reopen(existing.ticketId, {}, requestUser()),
      ).rejects.toThrow(BadRequestException);

      expect(ticketsRepository.save).not.toHaveBeenCalled();
    },
  );

  it('rejects CLOSED -> CLAIMED and CLOSED -> CLOSED without writing', async () => {
    const existing = ticket({
      status: TicketStatus.CLOSED,
      agentId: null,
      closedAt: new Date('2026-09-16T01:00:00.000Z'),
    });
    ticketsRepository.findById.mockResolvedValue(existing);

    await expect(service.claim(existing.ticketId, agentUser())).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.close(existing.ticketId, {}, agentUser()),
    ).rejects.toThrow(BadRequestException);

    expect(ticketsRepository.claimIfAvailable).not.toHaveBeenCalled();
    expect(ticketsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects modifying or cancelling a CLAIMED ticket without saving', async () => {
    const existing = ticket({
      status: TicketStatus.CLAIMED,
      agentId: AGENT_ID,
    });
    ticketsRepository.findById.mockResolvedValue(existing);

    await expect(
      service.modify(existing.ticketId, { title: 'New title' }, requestUser()),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.cancel(existing.ticketId, requestUser()),
    ).rejects.toThrow(BadRequestException);

    expect(ticketsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects modifying or cancelling a CLOSED ticket without saving', async () => {
    const existing = ticket({
      status: TicketStatus.CLOSED,
      agentId: null,
      closedAt: new Date('2026-09-16T01:00:00.000Z'),
    });
    ticketsRepository.findById.mockResolvedValue(existing);

    await expect(
      service.modify(existing.ticketId, { title: 'New title' }, requestUser()),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.cancel(existing.ticketId, requestUser()),
    ).rejects.toThrow(BadRequestException);

    expect(ticketsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects claiming a ticket outside the agent department without claiming', async () => {
    const existing = ticket();
    ticketsRepository.findById.mockResolvedValue(existing);
    departmentsRepository.findActiveDepartmentIdsByUserId.mockResolvedValue([
      HR_DEPARTMENT_ID,
    ]);

    await expect(
      service.claim(existing.ticketId, agentUser(AGENT_2_ID)),
    ).rejects.toThrow(ForbiddenException);

    expect(ticketsRepository.claimIfAvailable).not.toHaveBeenCalled();
  });

  it('rejects closing by an agent who did not claim the ticket without saving', async () => {
    const existing = ticket({
      status: TicketStatus.CLAIMED,
      agentId: AGENT_ID,
    });
    ticketsRepository.findById.mockResolvedValue(existing);

    await expect(
      service.close(existing.ticketId, {}, agentUser(AGENT_2_ID)),
    ).rejects.toThrow(ForbiddenException);

    expect(ticketsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects reopening by someone other than the submitter without saving', async () => {
    const existing = ticket({
      status: TicketStatus.CLOSED,
      agentId: null,
      closedAt: new Date('2026-09-16T01:00:00.000Z'),
    });
    ticketsRepository.findById.mockResolvedValue(existing);

    await expect(
      service.reopen(
        existing.ticketId,
        {},
        requestUser({ userId: EMPLOYEE_2_ID }),
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(ticketsRepository.save).not.toHaveBeenCalled();
  });

  function ticket(overrides: Partial<Ticket> = {}): Ticket {
    return {
      ticketId: 'ticket-1',
      ticketCode: 'TKT-0001',
      title: 'Laptop will not start',
      description: 'The laptop stays on a black screen',
      priority: TicketPriority.HIGH,
      status: TicketStatus.OPEN,
      departmentId: IT_DEPARTMENT_ID,
      submittedBy: EMPLOYEE_ID,
      agentId: null,
      active: true,
      completionNotes: null,
      createdAt: new Date('2026-09-16T00:00:00.000Z'),
      updatedAt: new Date('2026-09-16T00:00:00.000Z'),
      closedAt: null,
      ...overrides,
    };
  }

  function requestUser(
    overrides: Partial<AuthenticatedRequestUser> = {},
  ): AuthenticatedRequestUser {
    return {
      userId: EMPLOYEE_ID,
      email: 'alex@company.com',
      fullName: 'Alex Employee',
      phoneNumber: null,
      role: UserRole.Employee,
      isActive: true,
      hasLogged: true,
      identityProviderId: 'idp-entra',
      identityProviderUserId: EMPLOYEE_ID,
      ...overrides,
    };
  }

  function agentUser(userId = AGENT_ID): AuthenticatedRequestUser {
    return requestUser({
      userId,
      email: `${userId}@company.com`,
      fullName: userId,
      role: UserRole.Agent,
      identityProviderUserId: userId,
    });
  }
});
