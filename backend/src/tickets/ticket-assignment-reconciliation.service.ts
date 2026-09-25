import { Injectable } from '@nestjs/common';
import { Prisma, TicketEventAction, TicketStatus } from '@prisma/client';
import { HandoffsService } from './handoffs/handoffs.service';
import { TicketEventsRepository } from './events/ticket-events.repository';
import { TicketLifecycleResult } from './repositories/ticket-lifecycle.repository';
import { TicketsRepository } from './repositories/tickets.repository';
import { TicketRealtimePublisher } from './realtime/ticket-realtime.publisher';

const REMOVAL_COMPLETION_NOTE = 'This agent was removed from the department.';
const DEACTIVATED_SUBMITTER_COMPLETION_NOTE =
  "The submitter's account has been deactivated.";
const DEACTIVATED_AGENT_COMPLETION_NOTE =
  "The assigned agent's account has been deactivated.";
const CANCELLABLE_SUBMITTED_STATUSES: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.REOPENED,
  TicketStatus.CLAIMED,
];

/** Owns ticket cleanup when an agent loses eligibility for a department. */
@Injectable()
export class TicketAssignmentReconciliationService {
  constructor(
    private readonly tickets: TicketsRepository,
    private readonly ticketEvents: TicketEventsRepository,
    private readonly handoffs: HandoffsService,
    private readonly realtime: TicketRealtimePublisher,
  ) {}

  async reconcileDepartmentClaims(
    userId: string,
    departmentId: string,
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<TicketLifecycleResult[]> {
    const candidates = await this.tickets.findActiveClaimedByAgentInDepartment(
      userId,
      departmentId,
      tx,
    );
    const mutations: TicketLifecycleResult[] = [];

    for (const candidate of candidates) {
      const current = await this.tickets.findByIdForUpdate(
        candidate.ticketId,
        tx,
      );
      if (
        !current ||
        !current.active ||
        current.status !== TicketStatus.CLAIMED ||
        current.agentId !== userId
      ) {
        continue;
      }

      await this.handoffs.cancelPendingForTicket(
        current.ticketId,
        actorId,
        'DEPARTMENT_MEMBERSHIP_CHANGED',
        tx,
      );
      const now = new Date();
      current.status = TicketStatus.CLOSED;
      current.agentId = null;
      current.completionNotes = REMOVAL_COMPLETION_NOTE;
      current.closedAt = now;
      current.unclaimedSince = null;
      current.lastReminderAt = null;
      current.updatedAt = now;
      const ticket = await this.tickets.save(current, tx);
      const ticketEventId = await this.ticketEvents.append(
        {
          ticketId: current.ticketId,
          userId: actorId,
          action: TicketEventAction.CLOSE,
          details: {
            agentId: userId,
            completionNotes: REMOVAL_COMPLETION_NOTE,
          },
          createdAt: now,
        },
        tx,
      );
      mutations.push({ ticket, ticketEventId });
    }
    return mutations;
  }

  async cancelTicketsForDeactivatedUser(
    userId: string,
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<TicketLifecycleResult[]> {
    const candidates = await this.tickets.findActiveSubmittedOrClaimedByUser(
      userId,
      tx,
    );
    const mutations: TicketLifecycleResult[] = [];

    for (const candidate of candidates) {
      const current = await this.tickets.findByIdForUpdate(
        candidate.ticketId,
        tx,
      );
      if (!current || !current.active) continue;

      const isSubmittedTicket =
        current.submittedBy === userId &&
        CANCELLABLE_SUBMITTED_STATUSES.includes(current.status);
      const isClaimedByUser =
        current.status === TicketStatus.CLAIMED && current.agentId === userId;
      if (!isSubmittedTicket && !isClaimedByUser) continue;

      await this.handoffs.cancelPendingForTicket(
        current.ticketId,
        actorId,
        'USER_DEACTIVATED',
        tx,
      );
      const now = new Date();
      current.active = false;
      current.agentId = null;
      current.unclaimedSince = null;
      current.lastReminderAt = null;
      current.updatedAt = now;
      if (current.status === TicketStatus.CLAIMED) {
        current.completionNotes = isClaimedByUser
          ? DEACTIVATED_AGENT_COMPLETION_NOTE
          : DEACTIVATED_SUBMITTER_COMPLETION_NOTE;
      }

      const ticket = await this.tickets.save(current, tx);
      const ticketEventId = await this.ticketEvents.append(
        {
          ticketId: current.ticketId,
          userId: actorId,
          action: TicketEventAction.DELETE,
          details: { deletedById: actorId },
          createdAt: now,
        },
        tx,
      );
      mutations.push({ ticket, ticketEventId });
    }

    return mutations;
  }

  cancelPendingForUser(
    userId: string,
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    return this.handoffs.cancelPendingForUser(userId, actorId, tx);
  }

  cancelPendingForUserInDepartment(
    userId: string,
    departmentId: string,
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    return this.handoffs.cancelPendingForUserInDepartment(
      userId,
      departmentId,
      actorId,
      tx,
    );
  }

  publish(mutations: TicketLifecycleResult[], actorId: string): void {
    for (const mutation of mutations) {
      this.realtime.publishMutation(
        mutation.ticket,
        mutation.ticketEventId,
        actorId,
        mutation.ticket.active
          ? TicketEventAction.CLOSE
          : TicketEventAction.DELETE,
      );
    }
  }
}
