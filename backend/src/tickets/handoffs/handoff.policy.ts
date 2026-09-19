import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  HandoffStatus,
  Ticket,
  TicketStatus,
  User,
  UserRole,
} from '@prisma/client';
import type { HandoffRecord } from './handoffs.repository';

type EligibleUser = Pick<User, 'userId' | 'isActive' | 'role'>;

@Injectable()
export class HandoffPolicy {
  assertEligibleUser(user: EligibleUser, label: string): void {
    if (!user.isActive || (user.role !== UserRole.Agent && user.role !== UserRole.Admin)) {
      throw new ForbiddenException(`${label} is not an eligible active agent`);
    }
  }

  assertRequest(
    ticket: Ticket,
    requester: EligibleUser,
    requestedAgent: EligibleUser,
    requesterInDepartment: boolean,
    requestedAgentInDepartment: boolean,
  ): void {
    if (!ticket.active) {
      throw new ConflictException('Inactive tickets cannot receive handoff requests');
    }
    if (ticket.status !== TicketStatus.CLAIMED) {
      throw new ConflictException('A handoff can only be requested for a CLAIMED ticket');
    }
    if (ticket.agentId !== requester.userId) {
      throw new ForbiddenException('Only the current ticket agent can request a handoff');
    }
    if (requester.userId === requestedAgent.userId) {
      throw new BadRequestException('A ticket cannot be handed off to the current agent');
    }
    this.assertEligibleUser(requester, 'The requester');
    this.assertEligibleUser(requestedAgent, 'The requested agent');
    if (!requesterInDepartment || !requestedAgentInDepartment) {
      throw new ForbiddenException(
        'Both agents must belong to the ticket department',
      );
    }
  }

  assertRequester(
    ticket: Ticket,
    requester: EligibleUser,
    requesterInDepartment: boolean,
  ): void {
    if (!ticket.active) {
      throw new ConflictException('Inactive tickets cannot receive handoff requests');
    }
    if (ticket.status !== TicketStatus.CLAIMED) {
      throw new ConflictException('A handoff can only be requested for a CLAIMED ticket');
    }
    if (ticket.agentId !== requester.userId) {
      throw new ForbiddenException('Only the current ticket agent can manage handoffs');
    }
    this.assertEligibleUser(requester, 'The requester');
    if (!requesterInDepartment) {
      throw new ForbiddenException('The requester must belong to the ticket department');
    }
  }

  assertPending(handoff: HandoffRecord): void {
    if (handoff.status !== HandoffStatus.PENDING) {
      throw new ConflictException('This handoff request has already been resolved');
    }
  }

  assertAccept(
    handoff: HandoffRecord,
    ticket: Ticket,
    actor: EligibleUser,
    requesterInDepartment: boolean,
    requestedAgentInDepartment: boolean,
  ): void {
    this.assertPending(handoff);
    if (handoff.requestedAgentId !== actor.userId) {
      throw new ForbiddenException('Only the requested agent can accept this handoff');
    }
    this.assertRequest(
      ticket,
      handoff.requester,
      handoff.requestedAgent,
      requesterInDepartment,
      requestedAgentInDepartment,
    );
    if (ticket.agentId !== handoff.requesterId) {
      throw new ConflictException('The ticket is no longer assigned to the requester');
    }
  }

  assertReject(handoff: HandoffRecord, actor: EligibleUser): void {
    this.assertPending(handoff);
    if (handoff.requestedAgentId !== actor.userId) {
      throw new ForbiddenException('Only the requested agent can reject this handoff');
    }
  }

  assertCancel(handoff: HandoffRecord, ticket: Ticket, actor: EligibleUser): void {
    this.assertPending(handoff);
    if (handoff.requesterId !== actor.userId) {
      throw new ForbiddenException('Only the requester can cancel this handoff');
    }
    if (ticket.agentId !== actor.userId || ticket.status !== TicketStatus.CLAIMED) {
      throw new ConflictException('The requester is no longer the current ticket agent');
    }
  }
}
