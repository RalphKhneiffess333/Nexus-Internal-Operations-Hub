import { NotFoundException } from '@nestjs/common';
import { describe, it, beforeEach, afterEach, expect } from "@jest/globals"
import { TicketPriority, TicketStatus } from '@prisma/client';
import { TicketsService } from './tickets.service';
import {
  AGENT_ID,
  EMPLOYEE_ID,
  HR_DEPARTMENT_ID,
  IT_DEPARTMENT_ID,
  createTicketsTestingModule,
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

    expect(await service.findAll()).toHaveLength(1);
    expect((await service.findOne(created.ticketId)).ticketId).toBe(
      created.ticketId,
    );
  });

  it('modifies an OPEN ticket', async () => {
    const created = await submitOpenTicket(service);

    const updated = await service.modify(created.ticketId, {
      title: 'VPN access request',
      description: 'Need VPN for remote work',
      priority: TicketPriority.LOW,
      departmentId: HR_DEPARTMENT_ID,
    });

    expect(updated.title).toBe('VPN access request');
    expect(updated.description).toBe('Need VPN for remote work');
    expect(updated.priority).toBe(TicketPriority.LOW);
    expect(updated.departmentId).toBe(HR_DEPARTMENT_ID);
    expect(updated.status).toBe(TicketStatus.OPEN);
  });

  it('cancels an OPEN ticket with a soft delete', async () => {
    const created = await submitOpenTicket(service);

    const cancelled = await service.cancel(created.ticketId);

    expect(cancelled.active).toBe(false);
    expect(await service.findAll()).toHaveLength(0);
    await expect(service.findOne(created.ticketId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects submission when the submitter or department does not exist', async () => {
    await expect(
      service.submit(submitDto({ submittedBy: 'missing-user' })),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.submit(submitDto({ departmentId: 'missing-dept' })),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns not found for an unknown ticket', async () => {
    await expect(service.findOne('missing-ticket')).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      service.claim('missing-ticket', { agentId: AGENT_ID }),
    ).rejects.toThrow(NotFoundException);
  });
});
