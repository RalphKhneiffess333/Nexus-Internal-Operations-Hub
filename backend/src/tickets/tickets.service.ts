import { Injectable, NotFoundException } from '@nestjs/common';
import { TicketStatus } from '../common/enums/ticket-status.enum';
import { DepartmentsRepository } from '../departments/repositories/departments.repository';
import { UsersRepository } from '../users/repositories/users.repository';
import { ClaimTicketDto } from './dto/claim-ticket.dto';
import { CloseTicketDto } from './dto/close-ticket.dto';
import { ModifyTicketDto } from './dto/modify-ticket.dto';
import { ReopenTicketDto } from './dto/reopen-ticket.dto';
import { SubmitTicketDto } from './dto/submit-ticket.dto';
import { Ticket } from './entities/ticket.entity';
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

  findAll(): Ticket[] {
    return this.ticketsRepository.findAll().filter((ticket) => ticket.active);
  }

  findOne(ticketId: string): Ticket {
    return this.getActiveTicket(ticketId);
  }

  submit(dto: SubmitTicketDto): Ticket {
    const submitter = this.usersRepository.findById(dto.submittedBy);
    const department = this.departmentsRepository.findById(dto.departmentId);
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

  claim(ticketId: string, dto: ClaimTicketDto): Ticket {
    const ticket = this.getActiveTicket(ticketId);
    const agent = this.usersRepository.findById(dto.agentId);
    this.claimTicketPolicy.assert(ticket, agent);

    ticket.status = TicketStatus.CLAIMED;
    ticket.agentId = dto.agentId;
    ticket.updatedAt = new Date();
    return this.ticketsRepository.save(ticket);
  }

  close(ticketId: string, dto: CloseTicketDto): Ticket {
    const ticket = this.getActiveTicket(ticketId);
    this.closeTicketPolicy.assert(ticket);

    const now = new Date();
    ticket.status = TicketStatus.CLOSED;
    ticket.agentId = null;
    ticket.completionNotes = dto.completionNotes ?? null;
    ticket.closedAt = now;
    ticket.updatedAt = now;
    return this.ticketsRepository.save(ticket);
  }

  reopen(ticketId: string, dto: ReopenTicketDto): Ticket {
    const ticket = this.getActiveTicket(ticketId);
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

  modify(ticketId: string, dto: ModifyTicketDto): Ticket {
    const ticket = this.getActiveTicket(ticketId);
    const department = dto.departmentId
      ? this.departmentsRepository.findById(dto.departmentId)
      : undefined;
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

  cancel(ticketId: string): Ticket {
    const ticket = this.getActiveTicket(ticketId);
    this.cancelTicketPolicy.assert(ticket);

    ticket.active = false;
    ticket.updatedAt = new Date();
    return this.ticketsRepository.save(ticket);
  }

  private getActiveTicket(ticketId: string): Ticket {
    const ticket = this.ticketsRepository.findById(ticketId);
    if (!ticket || !ticket.active) {
      throw new NotFoundException(`Ticket ${ticketId} was not found`);
    }
    return ticket;
  }
}
