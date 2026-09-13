import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Ticket, TicketStatus } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { DepartmentsRepository } from '../departments/repositories/departments.repository';
import { CloseTicketDto } from './dto/close-ticket.dto';
import { ModifyTicketDto } from './dto/modify-ticket.dto';
import { ReopenTicketDto } from './dto/reopen-ticket.dto';
import { SubmitTicketDto } from './dto/submit-ticket.dto';
import { CancelTicketPolicy } from './policies/cancel-ticket.policy';
import { ClaimTicketPolicy } from './policies/claim-ticket.policy';
import { CloseTicketPolicy } from './policies/close-ticket.policy';
import { ModifyTicketPolicy } from './policies/modify-ticket.policy';
import { ReopenTicketPolicy } from './policies/reopen-ticket.policy';
import { SubmitTicketPolicy } from './policies/submit-ticket.policy';
import { ViewTicketPolicy } from './policies/view-ticket.policy';
import { TicketsRepository } from './repositories/tickets.repository';

@Injectable()
export class TicketsService {
  constructor(
    private readonly ticketsRepository: TicketsRepository,
    private readonly departmentsRepository: DepartmentsRepository,
    private readonly submitTicketPolicy: SubmitTicketPolicy,
    private readonly claimTicketPolicy: ClaimTicketPolicy,
    private readonly closeTicketPolicy: CloseTicketPolicy,
    private readonly reopenTicketPolicy: ReopenTicketPolicy,
    private readonly modifyTicketPolicy: ModifyTicketPolicy,
    private readonly cancelTicketPolicy: CancelTicketPolicy,
    private readonly viewTicketPolicy: ViewTicketPolicy,
  ) {}

  async findAll(actor: AuthenticatedRequestUser): Promise<Ticket[]> {
    const tickets = await this.ticketsRepository.findAll();
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    return tickets.filter(
      (ticket) =>
        ticket.active &&
        this.viewTicketPolicy.canView(actor, ticket, actorDepartmentIds),
    );
  }

  async findOne(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<Ticket> {
    const ticket = await this.getActiveTicket(ticketId);
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    this.viewTicketPolicy.assert(actor, ticket, actorDepartmentIds);
    return ticket;
  }

  async submit(
    dto: SubmitTicketDto,
    actor: AuthenticatedRequestUser,
  ): Promise<Ticket> {
    const department = await this.departmentsRepository.findById(
      dto.departmentId,
    );
    this.submitTicketPolicy.assert(department);

    const now = new Date();
    return this.ticketsRepository.create({
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
    });
  }

  async claim(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<Ticket> {
    const ticket = await this.getActiveTicket(ticketId);
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    this.claimTicketPolicy.assert(ticket, actor, actorDepartmentIds);

    const claimed = await this.ticketsRepository.claimIfAvailable(
      ticketId,
      actor.userId,
    );
    if (!claimed) {
      throw new BadRequestException(
        'A ticket cannot be claimed if it already has an assigned agent',
      );
    }

    return claimed;
  }

  async close(
    ticketId: string,
    dto: CloseTicketDto,
    actor: AuthenticatedRequestUser,
  ): Promise<Ticket> {
    const ticket = await this.getActiveTicket(ticketId);
    this.closeTicketPolicy.assert(ticket, actor);

    const now = new Date();
    ticket.status = TicketStatus.CLOSED;
    ticket.agentId = null;
    ticket.completionNotes = dto.completionNotes ?? null;
    ticket.closedAt = now;
    ticket.updatedAt = now;
    return this.ticketsRepository.save(ticket);
  }

  async reopen(
    ticketId: string,
    dto: ReopenTicketDto,
    actor: AuthenticatedRequestUser,
  ): Promise<Ticket> {
    const ticket = await this.getActiveTicket(ticketId);
    this.reopenTicketPolicy.assert(ticket, actor);

    ticket.status = TicketStatus.REOPENED;
    ticket.agentId = null;
    ticket.closedAt = null;
    if (dto.description) {
      ticket.description = dto.description;
    }
    ticket.updatedAt = new Date();
    return this.ticketsRepository.save(ticket);
  }

  async modify(
    ticketId: string,
    dto: ModifyTicketDto,
    actor: AuthenticatedRequestUser,
  ): Promise<Ticket> {
    const ticket = await this.getActiveTicket(ticketId);
    const department = dto.departmentId
      ? await this.departmentsRepository.findById(dto.departmentId)
      : null;
    this.modifyTicketPolicy.assert(ticket, actor, dto, department);

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
    ticket.updatedAt = new Date();
    return this.ticketsRepository.save(ticket);
  }

  async cancel(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<Ticket> {
    const ticket = await this.getActiveTicket(ticketId);
    this.cancelTicketPolicy.assert(ticket, actor);

    ticket.active = false;
    ticket.updatedAt = new Date();
    return this.ticketsRepository.save(ticket);
  }

  private async getActorDepartmentIds(
    actor: AuthenticatedRequestUser,
  ): Promise<string[]> {
    return this.departmentsRepository.findActiveDepartmentIdsByUserId(
      actor.userId,
    );
  }

  private async getActiveTicket(ticketId: string): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findById(ticketId);
    if (!ticket || !ticket.active) {
      throw new NotFoundException(`Ticket ${ticketId} was not found`);
    }
    return ticket;
  }
}
