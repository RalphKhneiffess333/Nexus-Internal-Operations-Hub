import { Injectable } from '@nestjs/common';
import { TicketStatus, UserRole } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import type { TicketRecord } from './repositories/tickets.repository';

export interface TicketActionPermissions {
  canModify: boolean;
  canCancel: boolean;
  canClaim: boolean;
  canClose: boolean;
  canRequestHandoff: boolean;
  canReopen: boolean;
}

export interface TicketUserProfile {
  userId: string;
  fullName: string;
  email: string;
}

export type TicketWithPermissions = Omit<
  TicketRecord,
  'submittedBy' | 'agentId' | 'submitter' | 'agent'
> & {
  submittedBy: TicketUserProfile;
  agent: TicketUserProfile | null;
  permissions: TicketActionPermissions;
};

@Injectable()
export class TicketResponseMapper {
  withPermissions(
    tickets: TicketRecord[],
    actor: AuthenticatedRequestUser,
    actorDepartmentIds: string[],
  ): TicketWithPermissions[] {
    return tickets.map((ticket) =>
      this.withPermission(ticket, actor, actorDepartmentIds),
    );
  }

  withPermission(
    ticket: TicketRecord,
    actor: AuthenticatedRequestUser,
    actorDepartmentIds: string[],
  ): TicketWithPermissions {
    const { submittedBy, agentId, submitter, agent, ...ticketFields } = ticket;

    return {
      ...ticketFields,
      submittedBy: {
        userId: submittedBy,
        fullName: submitter.fullName,
        email: submitter.email,
      },
      agent:
        agent && agentId
          ? {
              userId: agentId,
              fullName: agent.fullName,
              email: agent.email,
            }
          : null,
      permissions: {
        canModify: this.canModify(ticket, actor),
        canCancel: this.canCancel(ticket, actor),
        canClaim: this.canClaim(ticket, actor, actorDepartmentIds),
        canClose: this.canClose(ticket, actor),
        canRequestHandoff: this.canRequestHandoff(
          ticket,
          actor,
          actorDepartmentIds,
        ),
        canReopen: this.canReopen(ticket, actor),
      },
    };
  }

  private canModify(ticket: TicketRecord, actor: AuthenticatedRequestUser) {
    return (
      ticket.active &&
      ticket.status === TicketStatus.OPEN &&
      ticket.agentId === null &&
      ticket.submittedBy === actor.userId
    );
  }

  private canCancel(ticket: TicketRecord, actor: AuthenticatedRequestUser) {
    return this.canModify(ticket, actor);
  }

  private canClaim(
    ticket: TicketRecord,
    actor: AuthenticatedRequestUser,
    actorDepartmentIds: string[],
  ) {
    const canWorkTickets =
      (actor.role === UserRole.Admin || actor.role === UserRole.Agent) &&
      actorDepartmentIds.includes(ticket.departmentId);

    return (
      canWorkTickets &&
      ticket.active &&
      (ticket.status === TicketStatus.OPEN ||
        ticket.status === TicketStatus.REOPENED) &&
      ticket.agentId === null
    );
  }

  private canClose(ticket: TicketRecord, actor: AuthenticatedRequestUser) {
    return (
      actor.isActive &&
      (actor.role === UserRole.Agent || actor.role === UserRole.Admin) &&
      ticket.active &&
      ticket.status === TicketStatus.CLAIMED &&
      (ticket.agentId === actor.userId || actor.role === UserRole.Admin)
    );
  }

  private canRequestHandoff(
    ticket: TicketRecord,
    actor: AuthenticatedRequestUser,
    actorDepartmentIds: string[],
  ) {
    return (
      actor.isActive &&
      (actor.role === UserRole.Agent || actor.role === UserRole.Admin) &&
      ticket.active &&
      ticket.status === TicketStatus.CLAIMED &&
      ticket.agentId === actor.userId &&
      actorDepartmentIds.includes(ticket.departmentId)
    );
  }

  private canReopen(ticket: TicketRecord, actor: AuthenticatedRequestUser) {
    return (
      ticket.active &&
      ticket.status === TicketStatus.CLOSED &&
      ticket.agentId === null &&
      ticket.submittedBy === actor.userId
    );
  }
}
