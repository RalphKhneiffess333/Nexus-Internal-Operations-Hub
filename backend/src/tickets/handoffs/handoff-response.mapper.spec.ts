import { HandoffStatus, TicketStatus, UserRole } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import type { HandoffRecord } from './handoffs.repository';
import { HandoffResponseMapper } from './handoff-response.mapper';

describe('HandoffResponseMapper', () => {
  it('maps participant, ticket, department, and current-agent fields', () => {
    const mapper = new HandoffResponseMapper();
    const handoff = {
      handoffId: 'handoff-1',
      status: HandoffStatus.PENDING,
      message: 'Please take this ticket',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
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
        fullName: 'Requested Agent',
        email: 'agent@example.com',
        role: UserRole.Agent,
        isActive: true,
      },
      ticket: {
        ticketId: 'ticket-1',
        ticketCode: 'TCK-001',
        title: 'Printer issue',
        status: TicketStatus.CLAIMED,
        active: true,
        agentId: 'requester-1',
        departmentId: 'dept-1',
        department: {
          departmentId: 'dept-1',
          code: 'IT',
          name: 'IT Support',
        },
        agent: {
          userId: 'requester-1',
          fullName: 'Requester',
          email: 'requester@example.com',
          role: UserRole.Agent,
          isActive: true,
        },
      },
    } as HandoffRecord;

    expect(mapper.toResponse(handoff)).toEqual({
      handoffId: 'handoff-1',
      status: HandoffStatus.PENDING,
      message: 'Please take this ticket',
      createdAt: handoff.createdAt,
      updatedAt: handoff.updatedAt,
      resolvedAt: null,
      ticket: {
        ticketId: 'ticket-1',
        ticketCode: 'TCK-001',
        title: 'Printer issue',
        status: TicketStatus.CLAIMED,
        active: true,
        department: {
          departmentId: 'dept-1',
          code: 'IT',
          name: 'IT Support',
        },
        currentAgent: {
          userId: 'requester-1',
          fullName: 'Requester',
          email: 'requester@example.com',
          role: UserRole.Agent,
          isActive: true,
        },
      },
      requester: handoff.requester,
      requestedAgent: handoff.requestedAgent,
    });
  });
});
