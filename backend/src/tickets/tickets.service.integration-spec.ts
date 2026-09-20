import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { TicketStatus } from '@prisma/client';
import { TicketsService } from './tickets.service';
import {
  AGENT_ID,
  AGENT_2_ID,
  ADMINISTRATION_DEPARTMENT_ID,
  EMPLOYEE_2_ID,
  EMPLOYEE_ID,
  HR_DEPARTMENT_ID,
  IT_AGENT_2_ID,
  IT_DEPARTMENT_ID,
  adminUser,
  agentUser,
  claimTicket,
  createTicketsTestingModule,
  requestUser,
  submitDto,
  submitOpenTicket,
} from './tickets.test-utils';

describe('TicketsService integration', () => {
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
    expect(ticket.agent).toBeNull();
    expect(ticket.active).toBe(true);
    expect(ticket.ticketCode).toMatch(/^TKT-\d{4}$/);
    expect(ticket.title).toBe('Laptop will not start');
    expect(ticket.submittedBy.userId).toBe(EMPLOYEE_ID);
    expect(ticket.departmentId).toBe(IT_DEPARTMENT_ID);
    expect(ticket.createdAt).toBeInstanceOf(Date);
  });

  it('retrieves submitted tickets', async () => {
    const created = await submitOpenTicket(service);

    expect(await service.list(requestUser())).toHaveLength(1);
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
        priority: 'LOW',
        departmentId: HR_DEPARTMENT_ID,
      },
      requestUser(),
    );

    expect(updated.title).toBe('VPN access request');
    expect(updated.description).toBe('Need VPN for remote work');
    expect(updated.priority).toBe('LOW');
    expect(updated.departmentId).toBe(HR_DEPARTMENT_ID);
    expect(updated.status).toBe(TicketStatus.OPEN);
  });

  it('cancels an OPEN ticket with a soft delete', async () => {
    const created = await submitOpenTicket(service);

    const cancelled = await service.cancel(created.ticketId, requestUser());

    expect(cancelled.active).toBe(false);
    expect(await service.list(requestUser())).toHaveLength(0);
    await expect(
      service.findOne(created.ticketId, requestUser()),
    ).rejects.toThrow(NotFoundException);
  });

  it('lets administrators inspect inactive ticket history without exposing it to other users', async () => {
    const created = await submitOpenTicket(service);
    await service.cancel(created.ticketId, requestUser());

    await expect(service.findOne(created.ticketId, adminUser())).resolves.toMatchObject({
      ticketId: created.ticketId,
      active: false,
    });
    await expect(service.findEvents(created.ticketId, adminUser())).resolves.toHaveLength(
      2,
    );
    await expect(service.findOne(created.ticketId, requestUser())).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      service.list(adminUser(), { includeInactive: true }),
    ).resolves.toHaveLength(1);
  });

  it('uses the authenticated user as the submitter', async () => {
    const ticket = await service.submit(submitDto(), requestUser());

    expect(ticket.submittedBy.userId).toBe(EMPLOYEE_ID);
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

    expect(await service.list(requestUser())).toHaveLength(1);
    expect(await service.list(agentUser(AGENT_ID))).toHaveLength(1);
    expect(await service.list(agentUser(AGENT_2_ID))).toHaveLength(1);
    expect(await service.list(adminUser())).toHaveLength(2);
    await expect(
      service.findOne(otherTicket.ticketId, requestUser()),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.findOne(employeeTicket.ticketId, agentUser(AGENT_2_ID)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows agents to submit administrator requests without exposing the queue to agents', async () => {
    const request = await submitOpenTicket(
      service,
      { departmentId: ADMINISTRATION_DEPARTMENT_ID },
      agentUser(AGENT_ID),
    );

    expect(request.departmentId).toBe(ADMINISTRATION_DEPARTMENT_ID);
    expect(
      (await service.list(agentUser(AGENT_ID), { scope: 'pool' })).map(
        (ticket) => ticket.ticketId,
      ),
    ).not.toContain(request.ticketId);
    expect(
      (await service.list(adminUser(), { scope: 'pool' })).map((ticket) => ticket.ticketId),
    ).toContain(request.ticketId);
    expect(
      (await service.list(adminUser(), { scope: 'pool' })).find(
        (ticket) => ticket.ticketId === request.ticketId,
      )?.permissions.canClaim,
    ).toBe(true);
  });

  it('prevents employees from submitting administrator requests', async () => {
    await expect(
      submitOpenTicket(service, {
        departmentId: ADMINISTRATION_DEPARTMENT_ID,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('limits the administrator department view to the administrator memberships', async () => {
    const itTicket = await submitOpenTicket(service);
    await submitOpenTicket(service, { departmentId: HR_DEPARTMENT_ID });

    const departmentTickets = await service.list(adminUser(), { scope: 'department' });

    expect(departmentTickets.map((ticket) => ticket.ticketId)).toEqual([
      itTicket.ticketId,
    ]);
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

  it('prevents agents from working tickets outside their department', async () => {
    const ticket = await submitOpenTicket(service, {
      departmentId: IT_DEPARTMENT_ID,
    });
    const hrAgent = agentUser(AGENT_2_ID);

    await expect(service.findOne(ticket.ticketId, hrAgent)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.claim(ticket.ticketId, hrAgent)).rejects.toThrow(
      ForbiddenException,
    );

    await claimTicket(service, ticket.ticketId, agentUser(AGENT_ID));

    await expect(
      service.close(
        ticket.ticketId,
        { completionNotes: 'Trying to close outside department' },
        hrAgent,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows admins to view outside their department but not claim there', async () => {
    const hrTicket = await submitOpenTicket(
      service,
      { departmentId: HR_DEPARTMENT_ID },
      requestUser({
        userId: EMPLOYEE_2_ID,
        email: 'sam@company.com',
        identityProviderUserId: EMPLOYEE_2_ID,
      }),
    );

    await expect(
      service.findOne(hrTicket.ticketId, adminUser()),
    ).resolves.toMatchObject({
      ticketId: hrTicket.ticketId,
      departmentId: HR_DEPARTMENT_ID,
    });
    await expect(service.claim(hrTicket.ticketId, adminUser())).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('returns submitted, department, and pool ticket scopes with action permissions', async () => {
    const employeeTicket = await submitOpenTicket(service);
    const hrTicket = await submitOpenTicket(
      service,
      { departmentId: HR_DEPARTMENT_ID },
      requestUser({
        userId: EMPLOYEE_2_ID,
        email: 'sam@company.com',
        identityProviderUserId: EMPLOYEE_2_ID,
      }),
    );

    const submittedTickets = await service.list(requestUser(), { scope: 'submitted' });
    expect(submittedTickets).toHaveLength(1);
    expect(submittedTickets[0].ticketId).toBe(employeeTicket.ticketId);
    expect(submittedTickets[0].permissions.canModify).toBe(true);
    expect(submittedTickets[0].permissions.canCancel).toBe(true);

    const agentDepartmentTickets = await service.list(agentUser(AGENT_ID), {
      scope: 'department',
    });
    expect(agentDepartmentTickets).toHaveLength(1);
    expect(agentDepartmentTickets[0].ticketId).toBe(employeeTicket.ticketId);
    expect(agentDepartmentTickets[0].permissions.canClaim).toBe(true);
    expect(agentDepartmentTickets[0].permissions.canModify).toBe(false);

    const agentPoolTickets = await service.list(agentUser(AGENT_ID), {
      scope: 'pool',
    });
    expect(agentPoolTickets).toHaveLength(1);
    expect(agentPoolTickets[0].ticketId).toBe(employeeTicket.ticketId);

    const adminPoolTickets = await service.list(adminUser(), {
      scope: 'pool',
    });
    expect(adminPoolTickets.map((ticket) => ticket.ticketId)).toEqual([
      employeeTicket.ticketId,
    ]);
    const adminClaimPermissions = new Map(
      adminPoolTickets.map((ticket) => [
        ticket.ticketId,
        ticket.permissions.canClaim,
      ]),
    );
    expect(adminClaimPermissions.get(employeeTicket.ticketId)).toBe(true);
    expect(adminClaimPermissions.has(hrTicket.ticketId)).toBe(false);

    await service.claim(employeeTicket.ticketId, agentUser(AGENT_ID));
    const claimedTickets = await service.list(agentUser(AGENT_ID), {
      scope: 'claimed',
    });
    expect(claimedTickets).toHaveLength(1);
    expect(claimedTickets[0].ticketId).toBe(employeeTicket.ticketId);
    expect(claimedTickets[0].agent?.userId).toBe(AGENT_ID);

    await service.close(
      employeeTicket.ticketId,
      { completionNotes: 'Completed by the assigned agent' },
      agentUser(AGENT_ID),
    );
    const resolvedTickets = await service.list(agentUser(AGENT_ID), {
      scope: 'resolved',
    });
    expect(resolvedTickets).toHaveLength(1);
    expect(resolvedTickets[0].ticketId).toBe(employeeTicket.ticketId);

    await service.reopen(
      employeeTicket.ticketId,
      { description: 'Additional information is required' },
      requestUser(),
    );
    await service.claim(employeeTicket.ticketId, agentUser(IT_AGENT_2_ID));

    const resolvedAfterReassignment = await service.list(agentUser(AGENT_ID), {
      scope: 'resolved',
    });
    expect(resolvedAfterReassignment).toHaveLength(1);
    expect(resolvedAfterReassignment[0].ticketId).toBe(employeeTicket.ticketId);
    expect(resolvedAfterReassignment[0].agent?.userId).toBe(IT_AGENT_2_ID);
  });
});
