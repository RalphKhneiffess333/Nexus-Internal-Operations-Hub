import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Ticket,
  TicketEventAction,
  TicketStatus,
  UserRole,
} from '@prisma/client';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { DepartmentsRepository } from '../departments/repositories/departments.repository';
import { CloseTicketDto } from './dto/close-ticket.dto';
import { ModifyTicketDto } from './dto/modify-ticket.dto';
import { ReopenTicketDto } from './dto/reopen-ticket.dto';
import { SubmitTicketDto } from './dto/submit-ticket.dto';
import type { TicketEventRecord } from './events/ticket-event.types';
import { TicketEventsRepository } from './events/ticket-events.repository';
import { CancelTicketPolicy } from './policies/cancel-ticket.policy';
import { ClaimTicketPolicy } from './policies/claim-ticket.policy';
import { CloseTicketPolicy } from './policies/close-ticket.policy';
import { ModifyTicketPolicy } from './policies/modify-ticket.policy';
import { ReopenTicketPolicy } from './policies/reopen-ticket.policy';
import { SubmitTicketPolicy } from './policies/submit-ticket.policy';
import { ViewTicketPolicy } from './policies/view-ticket.policy';
import {
  TicketRecord,
  TicketsRepository,
} from './repositories/tickets.repository';
import { TicketLifecycleRepository } from './repositories/ticket-lifecycle.repository';

export interface TicketActionPermissions {
  canModify: boolean;
  canCancel: boolean;
  canClaim: boolean;
  canClose: boolean;
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
export class TicketsService {
  constructor(
    private readonly ticketsRepository: TicketsRepository,
    private readonly ticketEventsRepository: TicketEventsRepository,
    private readonly ticketLifecycleRepository: TicketLifecycleRepository,
    private readonly departmentsRepository: DepartmentsRepository,
    private readonly submitTicketPolicy: SubmitTicketPolicy,
    private readonly claimTicketPolicy: ClaimTicketPolicy,
    private readonly closeTicketPolicy: CloseTicketPolicy,
    private readonly reopenTicketPolicy: ReopenTicketPolicy,
    private readonly modifyTicketPolicy: ModifyTicketPolicy,
    private readonly cancelTicketPolicy: CancelTicketPolicy,
    private readonly viewTicketPolicy: ViewTicketPolicy,
  ) {}

  async findAll(
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions[]> {
    const tickets = await this.ticketsRepository.findAll();
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    return this.withPermissions(
      tickets.filter(
        (ticket) =>
          ticket.active &&
          this.viewTicketPolicy.canView(actor, ticket, actorDepartmentIds),
      ),
      actor,
      actorDepartmentIds,
    );
  }

  async findSubmitted(
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions[]> {
    const tickets = await this.ticketsRepository.findActiveBySubmitter(
      actor.userId,
    );
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    return this.withPermissions(tickets, actor, actorDepartmentIds);
  }

  async findDepartmentTickets(
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions[]> {
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    const tickets =
      actor.role === UserRole.Admin
        ? await this.ticketsRepository.findActive()
        : await this.ticketsRepository.findActiveByDepartmentIds(
            actorDepartmentIds,
          );
    return this.withPermissions(tickets, actor, actorDepartmentIds);
  }

  async findPool(
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions[]> {
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    const tickets = await this.ticketsRepository.findTicketPool(
      actor.role === UserRole.Admin ? undefined : actorDepartmentIds,
    );
    return this.withPermissions(tickets, actor, actorDepartmentIds);
  }

  async findOne(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions> {
    const ticket = await this.getActiveTicket(ticketId);
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    this.viewTicketPolicy.assert(actor, ticket, actorDepartmentIds);
    return this.withPermission(ticket, actor, actorDepartmentIds);
  }

  async findEvents(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketEventRecord[]> {
    await this.assertCanViewTicket(ticketId, actor);
    return this.ticketEventsRepository.findByTicketId(ticketId);
  }

  async findEvent(
    ticketId: string,
    ticketEventId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketEventRecord> {
    await this.assertCanViewTicket(ticketId, actor);
    const event = await this.ticketEventsRepository.findByIdForTicket(
      ticketId,
      ticketEventId,
    );
    if (!event) {
      throw new NotFoundException(
        `Ticket event ${ticketEventId} was not found`,
      );
    }
    return event;
  }

  async submit(
    dto: SubmitTicketDto,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions> {
    const department = await this.departmentsRepository.findById(
      dto.departmentId,
    );
    this.submitTicketPolicy.assert(department);

    const now = new Date();
    const ticket = await this.ticketLifecycleRepository.createWithEvent(
      {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        status: TicketStatus.OPEN,
        departmentId: dto.departmentId,
        submittedBy: actor.userId,
        agentId: null,
        active: true,
        completionNotes: null,
        createdAt: now,
        updatedAt: now,
        closedAt: null,
      },
      {
        userId: actor.userId,
        action: TicketEventAction.SUBMISSION,
        details: {
          title: dto.title,
          departmentId: dto.departmentId,
          priority: dto.priority,
          description: dto.description,
          submitterId: actor.userId,
        },
        createdAt: now,
      },
    );
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    return this.withPermission(ticket, actor, actorDepartmentIds);
  }

  async claim(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions> {
    const ticket = await this.getActiveTicket(ticketId);
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    this.claimTicketPolicy.assert(ticket, actor, actorDepartmentIds);

    const now = new Date();
    const claimed = await this.ticketLifecycleRepository.claimWithEvent(
      ticketId,
      actor.userId,
      {
        ticketId,
        userId: actor.userId,
        action: TicketEventAction.CLAIM,
        details: {
          agentId: actor.userId,
          timestamp: now.toISOString(),
        },
        createdAt: now,
      },
    );
    if (!claimed) {
      throw new BadRequestException(
        'A ticket cannot be claimed if it already has an assigned agent',
      );
    }

    return this.withPermission(claimed, actor, actorDepartmentIds);
  }

  async close(
    ticketId: string,
    dto: CloseTicketDto,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions> {
    const ticket = await this.getActiveTicket(ticketId);
    this.closeTicketPolicy.assert(ticket, actor);

    const now = new Date();
    ticket.status = TicketStatus.CLOSED;
    ticket.agentId = null;
    ticket.completionNotes = dto.completionNotes ?? null;
    ticket.closedAt = now;
    ticket.updatedAt = now;
    const closed = await this.ticketLifecycleRepository.saveWithEvent(ticket, {
      ticketId,
      userId: actor.userId,
      action: TicketEventAction.CLOSE,
      details: {
        agentId: actor.userId,
        completionNotes: ticket.completionNotes,
      },
      createdAt: now,
    });
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    return this.withPermission(closed, actor, actorDepartmentIds);
  }

  async reopen(
    ticketId: string,
    dto: ReopenTicketDto,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions> {
    const ticket = await this.getActiveTicket(ticketId);
    this.reopenTicketPolicy.assert(ticket, actor);

    ticket.status = TicketStatus.REOPENED;
    ticket.agentId = null;
    ticket.closedAt = null;
    if (dto.description) {
      ticket.description = dto.description;
    }
    const now = new Date();
    ticket.updatedAt = now;
    const reopened = await this.ticketLifecycleRepository.saveWithEvent(
      ticket,
      {
        ticketId,
        userId: actor.userId,
        action: TicketEventAction.REOPEN,
        details: {
          priority: ticket.priority,
          description: ticket.description,
          submitterId: ticket.submittedBy,
        },
        createdAt: now,
      },
    );
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    return this.withPermission(reopened, actor, actorDepartmentIds);
  }

  async modify(
    ticketId: string,
    dto: ModifyTicketDto,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions> {
    const ticket = await this.getActiveTicket(ticketId);
    const department = dto.departmentId
      ? await this.departmentsRepository.findById(dto.departmentId)
      : null;
    this.modifyTicketPolicy.assert(ticket, actor, dto, department);

    const oldTitle = ticket.title;
    const oldDescription = ticket.description;
    const oldPriority = ticket.priority;
    const oldDepartmentId = ticket.departmentId;

    if (dto.departmentId !== undefined) {
      ticket.departmentId = dto.departmentId;
    }
    if (dto.title !== undefined) {
      ticket.title = dto.title;
    }
    if (dto.description !== undefined) {
      ticket.description = dto.description;
    }
    if (dto.priority !== undefined) {
      ticket.priority = dto.priority;
    }
    const changed =
      oldTitle !== ticket.title ||
      oldDescription !== ticket.description ||
      oldPriority !== ticket.priority ||
      oldDepartmentId !== ticket.departmentId;
    if (!changed) {
      const actorDepartmentIds = await this.getActorDepartmentIds(actor);
      return this.withPermission(ticket, actor, actorDepartmentIds);
    }

    const now = new Date();
    ticket.updatedAt = now;
    const updated = await this.ticketLifecycleRepository.saveWithEvent(ticket, {
      ticketId,
      userId: actor.userId,
      action: TicketEventAction.MODIFICATION,
      details: {
        oldTitle,
        newTitle: ticket.title,
        oldDepartmentId,
        newDepartmentId: ticket.departmentId,
        oldPriority,
        newPriority: ticket.priority,
        oldDescription,
        newDescription: ticket.description,
      },
      createdAt: now,
    });
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    return this.withPermission(updated, actor, actorDepartmentIds);
  }

  async cancel(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions> {
    const ticket = await this.getActiveTicket(ticketId);
    this.cancelTicketPolicy.assert(ticket, actor);

    ticket.active = false;
    const now = new Date();
    ticket.updatedAt = now;
    const cancelled = await this.ticketLifecycleRepository.saveWithEvent(
      ticket,
      {
        ticketId,
        userId: actor.userId,
        action: TicketEventAction.DELETE,
        details: {
          deletedById: actor.userId,
        },
        createdAt: now,
      },
    );
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    return this.withPermission(cancelled, actor, actorDepartmentIds);
  }

  private async getActorDepartmentIds(
    actor: AuthenticatedRequestUser,
  ): Promise<string[]> {
    return this.departmentsRepository.findActiveDepartmentIdsByUserId(
      actor.userId,
    );
  }

  private async getActiveTicket(ticketId: string): Promise<TicketRecord> {
    const ticket = await this.ticketsRepository.findById(ticketId);
    if (!ticket || !ticket.active) {
      throw new NotFoundException(`Ticket ${ticketId} was not found`);
    }
    return ticket;
  }

  private async assertCanViewTicket(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<void> {
    const ticket = await this.getActiveTicket(ticketId);
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    this.viewTicketPolicy.assert(actor, ticket, actorDepartmentIds);
  }

  private withPermissions(
    tickets: TicketRecord[],
    actor: AuthenticatedRequestUser,
    actorDepartmentIds: string[],
  ): TicketWithPermissions[] {
    return tickets.map((ticket) =>
      this.withPermission(ticket, actor, actorDepartmentIds),
    );
  }

  private withPermission(
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
        canReopen: this.canReopen(ticket, actor),
      },
    };
  }

  private canModify(ticket: Ticket, actor: AuthenticatedRequestUser): boolean {
    return (
      ticket.active &&
      ticket.status === TicketStatus.OPEN &&
      ticket.agentId === null &&
      ticket.submittedBy === actor.userId
    );
  }

  private canCancel(ticket: Ticket, actor: AuthenticatedRequestUser): boolean {
    return this.canModify(ticket, actor);
  }

  private canClaim(
    ticket: Ticket,
    actor: AuthenticatedRequestUser,
    actorDepartmentIds: string[],
  ): boolean {
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

  private canClose(ticket: Ticket, actor: AuthenticatedRequestUser): boolean {
    return (
      ticket.active &&
      ticket.status === TicketStatus.CLAIMED &&
      ticket.agentId === actor.userId
    );
  }

  private canReopen(ticket: Ticket, actor: AuthenticatedRequestUser): boolean {
    return (
      ticket.active &&
      ticket.status === TicketStatus.CLOSED &&
      ticket.agentId === null &&
      ticket.submittedBy === actor.userId
    );
  }
}
