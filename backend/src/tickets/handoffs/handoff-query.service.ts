import { Injectable, NotFoundException } from '@nestjs/common';
import { HandoffStatus } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../../authentication/request-user';
import { DepartmentsRepository } from '../../departments/repositories/departments.repository';
import { ViewTicketPolicy } from '../policies/view-ticket.policy';
import { TicketsRepository } from '../repositories/tickets.repository';
import { HandoffQueryDto } from './handoff.dto';
import { HandoffPolicy } from './handoff.policy';
import { HandoffResponseMapper } from './handoff-response.mapper';
import { HandoffsRepository } from './handoffs.repository';
import type {
  HandoffResponse,
  HandoffUserSummary,
} from './handoff-response.mapper';

@Injectable()
export class HandoffQueryService {
  constructor(
    private readonly handoffsRepository: HandoffsRepository,
    private readonly ticketsRepository: TicketsRepository,
    private readonly departmentsRepository: DepartmentsRepository,
    private readonly handoffPolicy: HandoffPolicy,
    private readonly viewTicketPolicy: ViewTicketPolicy,
    private readonly handoffResponseMapper: HandoffResponseMapper,
  ) {}

  async list(
    actor: AuthenticatedRequestUser,
    direction: 'incoming' | 'outgoing' | 'all',
    query: HandoffQueryDto,
  ): Promise<HandoffResponse[]> {
    const handoffs = await this.handoffsRepository.findForActor(
      actor.userId,
      direction,
      query,
    );
    return handoffs.map((handoff) =>
      this.handoffResponseMapper.toResponse(handoff),
    );
  }

  async listForTicket(
    ticketId: string,
    actor: AuthenticatedRequestUser,
    status?: HandoffStatus,
  ): Promise<HandoffResponse[]> {
    const ticket = await this.ticketsRepository.findById(ticketId);
    if (!ticket || !ticket.active) {
      throw new NotFoundException('Ticket was not found');
    }

    const departmentIds =
      await this.departmentsRepository.findActiveDepartmentIdsByUserId(
        actor.userId,
      );
    this.viewTicketPolicy.assert(actor, ticket, departmentIds);

    const handoffs = await this.handoffsRepository.findByTicketId(
      ticketId,
      status,
    );
    return handoffs.map((handoff) =>
      this.handoffResponseMapper.toResponse(handoff),
    );
  }

  async listEligibleAgents(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<HandoffUserSummary[]> {
    const ticket = await this.ticketsRepository.findById(ticketId);
    if (!ticket || !ticket.active) {
      throw new NotFoundException('Ticket was not found');
    }

    const requester = await this.handoffsRepository.findUser(actor.userId);
    if (!requester) throw new NotFoundException('Requester was not found');

    const requesterInDepartment = await this.handoffsRepository.isActiveMember(
      actor.userId,
      ticket.departmentId,
    );
    this.handoffPolicy.assertRequester(
      ticket,
      requester,
      requesterInDepartment,
    );

    const agents = await this.handoffsRepository.findEligibleAgents(
      ticket.departmentId,
      actor.userId,
    );
    return agents.map((agent) =>
      this.handoffResponseMapper.toUserSummary(agent),
    );
  }
}
