import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Ticket, TicketStatus } from '@prisma/client';
import { DepartmentsRepository } from '../departments/repositories/departments.repository';
import { UsersRepository } from '../users/repositories/users.repository';
import { ClaimTicketDto } from './dto/claim-ticket.dto';
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
import { TicketsRepository } from './repositories/tickets.repository';

@Injectable()
export class TicketsService {
  constructor(
    private readonly ticketsRepository: TicketsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly departmentsRepository: DepartmentsRepository,
    private readonly submitTicketPolicy: SubmitTicketPolicy,
    private readonly claimTicketPolicy: ClaimTicketPolicy,
    private readonly closeTicketPolicy: CloseTicketPolicy,
    private readonly reopenTicketPolicy: ReopenTicketPolicy,
    private readonly modifyTicketPolicy: ModifyTicketPolicy,
    private readonly cancelTicketPolicy: CancelTicketPolicy,
  ) {}

  async findAll(): Promise<Ticket[]> {
    const tickets = await this.ticketsRepository.findAll();
    return tickets.filter((ticket) => ticket.active);
  }

  async findOne(ticketId: string): Promise<Ticket> {
    return this.getActiveTicket(ticketId);
  }

  async submit(dto: SubmitTicketDto): Promise<Ticket> {
    const submitter = await this.usersRepository.findById(dto.submittedBy);
    const department = await this.departmentsRepository.findById(
      dto.departmentId,
    );
    this.submitTicketPolicy.assert(submitter, department);

    const now = new Date();
    return this.ticketsRepository.create({
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      status: TicketStatus.OPEN,
      departmentId: dto.departmentId,
      submittedBy: dto.submittedBy,
      agentId: null,
      active: true,
      completionNotes: null,
      createdAt: now,
      updatedAt: now,
      closedAt: null,
    });
  }

  async claim(ticketId: string, dto: ClaimTicketDto): Promise<Ticket> {
    const ticket = await this.getActiveTicket(ticketId);
    const agent = await this.usersRepository.findById(dto.agentId);
    this.claimTicketPolicy.assert(ticket, agent);

    const claimed = await this.ticketsRepository.claimIfAvailable(
      ticketId,
      dto.agentId,
    );
    if (!claimed) {
      throw new BadRequestException(
        'A ticket cannot be claimed if it already has an assigned agent',
      );
    }

    return claimed;
  }

  async close(ticketId: string, dto: CloseTicketDto): Promise<Ticket> {
    const ticket = await this.getActiveTicket(ticketId);
    this.closeTicketPolicy.assert(ticket);

    const now = new Date();
    ticket.status = TicketStatus.CLOSED;
    ticket.agentId = null;
    ticket.completionNotes = dto.completionNotes ?? null;
    ticket.closedAt = now;
    ticket.updatedAt = now;
    return this.ticketsRepository.save(ticket);
  }

  async reopen(ticketId: string, dto: ReopenTicketDto): Promise<Ticket> {
    const ticket = await this.getActiveTicket(ticketId);
    this.reopenTicketPolicy.assert(ticket);

    ticket.status = TicketStatus.REOPENED;
    ticket.agentId = null;
    ticket.closedAt = null;
    if (dto.description) {
      ticket.description = dto.description;
    }
    ticket.updatedAt = new Date();
    return this.ticketsRepository.save(ticket);
  }

  async modify(ticketId: string, dto: ModifyTicketDto): Promise<Ticket> {
    const ticket = await this.getActiveTicket(ticketId);
    const department = dto.departmentId
      ? await this.departmentsRepository.findById(dto.departmentId)
      : null;
    this.modifyTicketPolicy.assert(ticket, dto, department);

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

  async cancel(ticketId: string): Promise<Ticket> {
    const ticket = await this.getActiveTicket(ticketId);
    this.cancelTicketPolicy.assert(ticket);

    ticket.active = false;
    ticket.updatedAt = new Date();
    return this.ticketsRepository.save(ticket);
  }

  private async getActiveTicket(ticketId: string): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findById(ticketId);
    if (!ticket || !ticket.active) {
      throw new NotFoundException(`Ticket ${ticketId} was not found`);
    }
    return ticket;
  }
}
