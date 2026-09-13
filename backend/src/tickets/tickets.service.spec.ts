import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { TicketPriority, TicketStatus, UserRole } from '@prisma/client';
import { TicketsService } from './tickets.service';
import {
  AGENT_ID,
  AGENT_2_ID,
  EMPLOYEE_2_ID,
  EMPLOYEE_ID,
  HR_DEPARTMENT_ID,
  IT_DEPARTMENT_ID,
  adminUser,
  agentUser,
  createTicketsTestingModule,
  requestUser,
  submitDto,
  submitOpenTicket,
} from './tickets.test-utils';

describe('TicketsService valid operations', () => {
  let service: TicketsService;
  let moduleRef: Awaited<ReturnType<typeof createTicketsTestingModule>>;

  beforeEach(async () => {
    moduleRef = await createTicketsTestingModule();
    service = moduleRef.get(TicketsService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('submits a ticket as OPEN with no assigned agent', async () => {
    const ticket = await submitOpenTicket(service);

    expect(ticket.status).toBe(TicketStatus.OPEN);
    expect(ticket.agentId).toBeNull();
    expect(ticket.active).toBe(true);
    expect(ticket.ticketCode).toMatch(/^TKT-\d{4}$/);
    expect(ticket.title).toBe('Laptop will not start');
    expect(ticket.submittedBy).toBe(EMPLOYEE_ID);
    expect(ticket.departmentId).toBe(IT_DEPARTMENT_ID);
    expect(ticket.createdAt).toBeInstanceOf(Date);
  });

  it('retrieves submitted tickets', async () => {
    const created = await submitOpenTicket(service);

    expect(await service.findAll(requestUser())).toHaveLength(1);
    expect(
      (await service.findOne(created.ticketId, requestUser())).ticketId,
    ).toBe(created.ticketId);
  });

  it('modifies an OPEN ticket', async () => {
    const created = await submitOpenTicket(service);

    const updated = await service.modify(
      created.ticketId,
      {
        title: 'VPN access request',
        description: 'Need VPN for remote work',
        priority: TicketPriority.LOW,
        departmentId: HR_DEPARTMENT_ID,
      },
      requestUser(),
    );

    expect(updated.title).toBe('VPN access request');
    expect(updated.description).toBe('Need VPN for remote work');
    expect(updated.priority).toBe(TicketPriority.LOW);
    expect(updated.departmentId).toBe(HR_DEPARTMENT_ID);
    expect(updated.status).toBe(TicketStatus.OPEN);
  });

  it('cancels an OPEN ticket with a soft delete', async () => {
    const created = await submitOpenTicket(service);

    const cancelled = await service.cancel(created.ticketId, requestUser());

    expect(cancelled.active).toBe(false);
    expect(await service.findAll(requestUser())).toHaveLength(0);
    await expect(
      service.findOne(created.ticketId, requestUser()),
    ).rejects.toThrow(NotFoundException);
  });

  it('uses the authenticated user as the submitter even when the body is tampered with', async () => {
    const ticket = await service.submit(
      submitDto({ submittedBy: EMPLOYEE_2_ID }),
      requestUser(),
    );

    expect(ticket.submittedBy).toBe(EMPLOYEE_ID);
  });

  it('rejects submission when the department does not exist', async () => {
    await expect(
      service.submit(
        submitDto({ departmentId: 'missing-dept' }),
        requestUser(),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns not found for an unknown ticket', async () => {
    await expect(
      service.findOne('missing-ticket', requestUser()),
    ).rejects.toThrow(NotFoundException);
    await expect(service.claim('missing-ticket', agentUser())).rejects.toThrow(
      NotFoundException,
    );
  });

  it('filters ticket visibility by actor role and resource access', async () => {
    const employeeTicket = await submitOpenTicket(service);
    const otherTicket = await submitOpenTicket(
      service,
      { departmentId: HR_DEPARTMENT_ID },
      requestUser({
        userId: EMPLOYEE_2_ID,
        email: 'sam@company.com',
        identityProviderUserId: EMPLOYEE_2_ID,
      }),
    );

    expect(await service.findAll(requestUser())).toHaveLength(1);
    expect(await service.findAll(agentUser(AGENT_ID))).toHaveLength(1);
    expect(await service.findAll(agentUser(AGENT_2_ID))).toHaveLength(1);
    expect(await service.findAll(adminUser())).toHaveLength(2);
    await expect(
      service.findOne(otherTicket.ticketId, requestUser()),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.findOne(employeeTicket.ticketId, agentUser(AGENT_2_ID)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects resource operations by the wrong owner or department agent', async () => {
    const ticket = await submitOpenTicket(service);

    await expect(
      service.claim(ticket.ticketId, agentUser(AGENT_2_ID)),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.modify(
        ticket.ticketId,
        { title: 'Malicious edit' },
        requestUser({
          userId: EMPLOYEE_2_ID,
          email: 'sam@company.com',
          identityProviderUserId: EMPLOYEE_2_ID,
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.cancel(
        ticket.ticketId,
        requestUser({
          userId: EMPLOYEE_2_ID,
          email: 'sam@company.com',
          identityProviderUserId: EMPLOYEE_2_ID,
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
