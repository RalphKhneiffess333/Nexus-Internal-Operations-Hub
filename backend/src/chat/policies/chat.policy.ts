import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TicketStatus, UserRole } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../../authentication/request-user';
import { ViewTicketPolicy } from '../../tickets/policies/view-ticket.policy';
import type { TicketRecord } from '../../tickets/repositories/tickets.repository';

@Injectable()
export class ChatPolicy {
  constructor(private readonly viewTicketPolicy: ViewTicketPolicy) {}

  assertCanView(
    actor: AuthenticatedRequestUser,
    ticket: TicketRecord,
    actorDepartmentIds: string[],
  ): void {
    if (!ticket.active) {
      throw new NotFoundException('Ticket was not found');
    }

    this.viewTicketPolicy.assert(actor, ticket, actorDepartmentIds);
  }

  assertCanSend(
    actor: AuthenticatedRequestUser,
    ticket: TicketRecord,
    actorDepartmentIds: string[],
  ): void {
    this.assertCanView(actor, ticket, actorDepartmentIds);
    if (ticket.status !== TicketStatus.CLAIMED || ticket.agentId === null) {
      throw new BadRequestException(
        'Messages can only be sent while a ticket is claimed',
      );
    }

    const isSubmitter = ticket.submittedBy === actor.userId;
    const isAssignedAgent =
      ticket.agentId === actor.userId &&
      actor.role !== UserRole.Employee &&
      actorDepartmentIds.includes(ticket.departmentId);
    if (!isSubmitter && !isAssignedAgent) {
      throw new ForbiddenException(
        'You do not have permission to send messages in this chat',
      );
    }
  }
}
