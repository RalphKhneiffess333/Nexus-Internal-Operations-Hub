import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { DepartmentsRepository } from '../departments/repositories/departments.repository';
import { ViewTicketPolicy } from './policies/view-ticket.policy';
import type { TicketRecord } from './repositories/tickets.repository';
import { TicketsRepository } from './repositories/tickets.repository';

/** Shared ticket lookup and resource-access rules for ticket application services. */
@Injectable()
export class TicketAccessService {
  constructor(
    private readonly ticketsRepository: TicketsRepository,
    private readonly departmentsRepository: DepartmentsRepository,
    private readonly viewTicketPolicy: ViewTicketPolicy,
  ) {}

  getActorDepartmentIds(actor: AuthenticatedRequestUser): Promise<string[]> {
    return this.departmentsRepository.findActiveDepartmentIdsByUserId(
      actor.userId,
    );
  }

  async getActiveTicket(ticketId: string): Promise<TicketRecord> {
    const ticket = await this.ticketsRepository.findById(ticketId);
    if (!ticket || !ticket.active) {
      throw new NotFoundException(`Ticket ${ticketId} was not found`);
    }
    return ticket;
  }

  async getTicketForView(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketRecord> {
    const ticket = await this.ticketsRepository.findById(ticketId);
    if (!ticket || (!ticket.active && actor.role !== UserRole.Admin)) {
      throw new NotFoundException(`Ticket ${ticketId} was not found`);
    }
    return ticket;
  }

  async assertCanViewTicket(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketRecord> {
    const ticket = await this.getTicketForView(ticketId, actor);
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    this.viewTicketPolicy.assert(actor, ticket, actorDepartmentIds);
    return ticket;
  }
}
