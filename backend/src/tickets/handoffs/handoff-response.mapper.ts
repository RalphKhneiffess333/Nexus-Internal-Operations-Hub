import { HandoffStatus, TicketStatus, UserRole } from '@prisma/client';
import type { HandoffRecord, HandoffUserRecord } from './handoffs.repository';

export interface HandoffUserSummary {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface HandoffResponse {
  handoffId: string;
  status: HandoffStatus;
  message: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  ticket: {
    ticketId: string;
    ticketCode: string;
    title: string;
    status: TicketStatus;
    active: boolean;
    department: { departmentId: string; code: string; name: string };
    currentAgent: HandoffUserSummary | null;
  };
  requester: HandoffUserSummary;
  requestedAgent: HandoffUserSummary;
}

export class HandoffResponseMapper {
  toResponse(handoff: HandoffRecord): HandoffResponse {
    return {
      handoffId: handoff.handoffId,
      status: handoff.status,
      message: handoff.message,
      createdAt: handoff.createdAt,
      updatedAt: handoff.updatedAt,
      resolvedAt: handoff.resolvedAt,
      ticket: {
        ticketId: handoff.ticket.ticketId,
        ticketCode: handoff.ticket.ticketCode,
        title: handoff.ticket.title,
        status: handoff.ticket.status,
        active: handoff.ticket.active,
        department: handoff.ticket.department,
        currentAgent: handoff.ticket.agent
          ? this.toUserSummary(handoff.ticket.agent)
          : null,
      },
      requester: this.toUserSummary(handoff.requester),
      requestedAgent: this.toUserSummary(handoff.requestedAgent),
    };
  }

  toUserSummary(user: HandoffUserRecord): HandoffUserSummary {
    return {
      userId: user.userId,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
  }
}
