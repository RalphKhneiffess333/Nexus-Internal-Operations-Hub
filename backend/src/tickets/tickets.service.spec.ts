import { NotFoundException } from '@nestjs/common';
import { describe, it, beforeEach, expect } from "@jest/globals"
import { TicketPriority } from '../common/enums/ticket-priority.enum';
import { TicketStatus } from '../common/enums/ticket-status.enum';
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

  beforeEach(async () => {
    const moduleRef = await createTicketsTestingModule();
    service = moduleRef.get(TicketsService);
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

    expect(service.findAll()).toHaveLength(1);
    expect(service.findOne(created.ticketId).ticketId).toBe(created.ticketId);
  });

  it('modifies an OPEN ticket', async () => {
    const created = await submitOpenTicket(service);

    const updated = service.modify(created.ticketId, {
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

    const cancelled = service.cancel(created.ticketId);

    expect(cancelled.active).toBe(false);
    expect(service.findAll()).toHaveLength(0);
    expect(() => service.findOne(created.ticketId)).toThrow(NotFoundException);
  });

  it('rejects submission when the submitter or department does not exist', async () => {
    expect(() =>
      service.submit(submitDto({ submittedBy: 'missing-user' })),
    ).toThrow(NotFoundException);
    expect(() =>
      service.submit(submitDto({ departmentId: 'missing-dept' })),
    ).toThrow(NotFoundException);
  });

  it('returns not found for an unknown ticket', () => {
    expect(() => service.findOne('missing-ticket')).toThrow(NotFoundException);
    expect(() =>
      service.claim('missing-ticket', { agentId: AGENT_ID }),
    ).toThrow(NotFoundException);
  });
});
