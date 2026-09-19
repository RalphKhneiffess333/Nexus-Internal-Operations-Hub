import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  HandoffStatus,
  Prisma,
  TicketEventAction,
  TicketStatus,
  UserRole,
} from '@prisma/client';
import type { AuthenticatedRequestUser } from '../../authentication/request-user';
import { PrismaService } from '../../database/prisma.service';
import { DepartmentsRepository } from '../../departments/repositories/departments.repository';
import { TicketEventsRepository } from '../events/ticket-events.repository';
import { ViewTicketPolicy } from '../policies/view-ticket.policy';
import { TicketsRepository } from '../repositories/tickets.repository';
import { CreateHandoffDto, HandoffQueryDto } from './handoff.dto';
import { HandoffPolicy } from './handoff.policy';
import {
  HandoffRecord,
  HandoffPersistenceClient,
  HandoffsRepository,
} from './handoffs.repository';

export interface HandoffUserSummary {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface HandoffResponse {
  handoffId: string;
  status: HandoffStatus;
  message: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  ticket: {
    ticketId: string;
    ticketCode: string;
    title: string;
    status: TicketStatus;
    active: boolean;
    department: { departmentId: string; code: string; name: string };
    currentAgent: HandoffUserSummary | null;
  };
  requester: HandoffUserSummary;
  requestedAgent: HandoffUserSummary;
}

@Injectable()
export class HandoffsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly handoffsRepository: HandoffsRepository,
    private readonly ticketEventsRepository: TicketEventsRepository,
    private readonly ticketsRepository: TicketsRepository,
    private readonly departmentsRepository: DepartmentsRepository,
    private readonly handoffPolicy: HandoffPolicy,
    private readonly viewTicketPolicy: ViewTicketPolicy,
  ) {}

  async create(
    ticketId: string,
    dto: CreateHandoffDto,
    actor: AuthenticatedRequestUser,
  ): Promise<HandoffResponse> {
    let createdHandoffId = '';
    await this.prisma.$transaction(async (tx) => {
      const ticket = await this.handoffsRepository.lockTicket(ticketId, tx);
      if (!ticket) throw new NotFoundException('Ticket was not found');

      const [requester, requestedAgent] = await Promise.all([
        this.handoffsRepository.findUser(actor.userId, tx),
        this.handoffsRepository.findUser(dto.requestedAgentId, tx),
      ]);
      if (!requester) throw new NotFoundException('Requester was not found');
      if (!requestedAgent) throw new NotFoundException('Requested agent was not found');

      const [requesterInDepartment, requestedAgentInDepartment] = await Promise.all([
        this.handoffsRepository.isActiveMember(requester.userId, ticket.departmentId, tx),
        this.handoffsRepository.isActiveMember(
          requestedAgent.userId,
          ticket.departmentId,
          tx,
        ),
      ]);
      this.handoffPolicy.assertRequest(
        ticket,
        requester,
        requestedAgent,
        requesterInDepartment,
        requestedAgentInDepartment,
      );

      const duplicate = await this.handoffsRepository.findPendingDuplicate(
        ticketId,
        requester.userId,
        requestedAgent.userId,
        tx,
      );
      if (duplicate) {
        throw new ConflictException('A pending handoff already exists for this agent');
      }

      const now = new Date();
      const handoff = await this.handoffsRepository.create(
        {
          handoffId: randomUUID(),
          ticketId,
          requesterId: requester.userId,
          requestedAgentId: requestedAgent.userId,
          status: HandoffStatus.PENDING,
          message: dto.message?.trim() || null,
          createdAt: now,
          updatedAt: now,
          resolvedAt: null,
        },
        tx,
      );
      createdHandoffId = handoff.handoffId;
      await this.ticketEventsRepository.append(
        {
          ticketId,
          userId: actor.userId,
          action: TicketEventAction.HANDOFF,
          details: {
            handoffId: handoff.handoffId,
            requesterId: requester.userId,
            requestedAgentId: requestedAgent.userId,
            action: 'REQUESTED',
            ...(handoff.message ? { message: handoff.message } : {}),
            timestamp: now.toISOString(),
          },
          createdAt: now,
        },
        tx,
      );
    });

    const created = await this.handoffsRepository.findById(createdHandoffId);
    if (!created) throw new NotFoundException('Handoff request was not found');
    return this.toResponse(created);
  }

  async list(
    actor: AuthenticatedRequestUser,
    direction: 'incoming' | 'outgoing' | 'all',
    query: HandoffQueryDto,
  ): Promise<HandoffResponse[]> {
    return (await this.handoffsRepository.findForActor(actor.userId, direction, query)).map(
      (handoff) => this.toResponse(handoff),
    );
  }

  async listForTicket(
    ticketId: string,
    actor: AuthenticatedRequestUser,
    status?: HandoffStatus,
  ): Promise<HandoffResponse[]> {
    const ticket = await this.ticketsRepository.findById(ticketId);
    if (!ticket || !ticket.active) throw new NotFoundException('Ticket was not found');
    const departmentIds = await this.departmentsRepository.findActiveDepartmentIdsByUserId(
      actor.userId,
    );
    this.viewTicketPolicy.assert(actor, ticket, departmentIds);
    return (await this.handoffsRepository.findByTicketId(ticketId, status)).map(
      (handoff) => this.toResponse(handoff),
    );
  }

  async listEligibleAgents(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<HandoffUserSummary[]> {
    const ticket = await this.ticketsRepository.findById(ticketId);
    if (!ticket || !ticket.active) throw new NotFoundException('Ticket was not found');
    const requester = await this.handoffsRepository.findUser(actor.userId, this.prisma);
    if (!requester) throw new NotFoundException('Requester was not found');
    const requesterInDepartment = await this.handoffsRepository.isActiveMember(
      actor.userId,
      ticket.departmentId,
      this.prisma,
    );
    this.handoffPolicy.assertRequester(ticket, requester, requesterInDepartment);
    const agents = await this.handoffsRepository.findEligibleAgents(
      ticket.departmentId,
      actor.userId,
    );
    return agents.map((agent) => this.toUserSummary(agent));
  }

  async accept(
    handoffId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<HandoffResponse> {
    const existing = await this.handoffsRepository.findById(handoffId);
    if (!existing) throw new NotFoundException('Handoff request was not found');

    await this.prisma.$transaction(async (tx) => {
      const ticket = await this.handoffsRepository.lockTicket(existing.ticketId, tx);
      if (!ticket) throw new NotFoundException('Ticket was not found');
      const handoff = await this.handoffsRepository.findByIdForUpdate(handoffId, tx);
      if (!handoff) throw new NotFoundException('Handoff request was not found');
      const [requester, requestedAgent] = await Promise.all([
        this.handoffsRepository.findUser(handoff.requesterId, tx),
        this.handoffsRepository.findUser(handoff.requestedAgentId, tx),
      ]);
      if (!requester || !requestedAgent) {
        throw new ConflictException('Handoff participants are no longer available');
      }
      const [requesterInDepartment, requestedAgentInDepartment] = await Promise.all([
        this.handoffsRepository.isActiveMember(requester.userId, ticket.departmentId, tx),
        this.handoffsRepository.isActiveMember(
          requestedAgent.userId,
          ticket.departmentId,
          tx,
        ),
      ]);
      const handoffWithUsers = {
        ...handoff,
        requester,
        requestedAgent,
      } as HandoffRecord;
      this.handoffPolicy.assertAccept(
        handoffWithUsers,
        ticket,
        requestedAgent,
        requesterInDepartment,
        requestedAgentInDepartment,
      );

      const now = new Date();
      await tx.ticket.update({
        where: { ticketId: ticket.ticketId },
        data: { agentId: requestedAgent.userId, status: TicketStatus.CLAIMED, updatedAt: now },
      });
      await this.handoffsRepository.updateStatus(
        handoffId,
        HandoffStatus.ACCEPTED,
        now,
        tx,
      );
      await this.ticketEventsRepository.append(
        {
          ticketId: ticket.ticketId,
          userId: actor.userId,
          action: TicketEventAction.HANDOFF,
          details: {
            handoffId,
            requesterId: handoff.requesterId,
            requestedAgentId: handoff.requestedAgentId,
            action: 'ACCEPTED',
            ...(handoff.message ? { message: handoff.message } : {}),
            timestamp: now.toISOString(),
          },
          createdAt: now,
        },
        tx,
      );
      await this.cancelPendingForTicket(
        ticket.ticketId,
        actor.userId,
        'SUPERSEDED_BY_ACCEPTANCE',
        tx,
      );
    });

    const accepted = await this.handoffsRepository.findById(handoffId);
    if (!accepted) throw new NotFoundException('Handoff request was not found');
    return this.toResponse(accepted);
  }

  async reject(
    handoffId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<HandoffResponse> {
    return this.resolve(handoffId, actor, HandoffStatus.REJECTED);
  }

  async cancel(
    handoffId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<HandoffResponse> {
    return this.resolve(handoffId, actor, HandoffStatus.CANCELLED);
  }

  async cancelPendingForTicket(
    ticketId: string,
    actorId: string,
    reason: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    await this.handoffsRepository.lockTicket(ticketId, client);
    const pending = await this.handoffsRepository.findPendingByTicketId(ticketId, client);
    for (const handoff of pending) {
      const now = new Date();
      await this.handoffsRepository.updateStatus(
        handoff.handoffId,
        HandoffStatus.CANCELLED,
        now,
        client,
      );
      await this.ticketEventsRepository.append(
        {
          ticketId,
          userId: actorId,
          action: TicketEventAction.HANDOFF,
          details: {
            handoffId: handoff.handoffId,
            requesterId: handoff.requesterId,
            requestedAgentId: handoff.requestedAgentId,
            action: 'CANCELLED',
            reason,
            timestamp: now.toISOString(),
          },
          createdAt: now,
        },
        client,
      );
    }
  }

  async cancelPendingForUserInDepartment(
    userId: string,
    departmentId: string,
    actorId: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    const pending = await this.handoffsRepository.findPendingForUserInDepartment(
      userId,
      departmentId,
      client,
    );
    const ticketIds = [...new Set(pending.map((handoff) => handoff.ticketId))].sort();
    for (const ticketId of ticketIds) {
      await this.cancelPendingForTicket(
        ticketId,
        actorId,
        'DEPARTMENT_MEMBERSHIP_CHANGED',
        client,
      );
    }
  }

  async cancelPendingForUser(
    userId: string,
    actorId: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    const pending = await this.handoffsRepository.findPendingForUser(userId, client);
    const ticketIds = [...new Set(pending.map((handoff) => handoff.ticketId))].sort();
    for (const ticketId of ticketIds) {
      await this.cancelPendingForTicket(
        ticketId,
        actorId,
        'USER_ELIGIBILITY_CHANGED',
        client,
      );
    }
  }

  private async resolve(
    handoffId: string,
    actor: AuthenticatedRequestUser,
    status: Extract<HandoffStatus, 'REJECTED' | 'CANCELLED'>,
  ): Promise<HandoffResponse> {
    const existing = await this.handoffsRepository.findById(handoffId);
    if (!existing) throw new NotFoundException('Handoff request was not found');

    await this.prisma.$transaction(async (tx) => {
      const ticket = await this.handoffsRepository.lockTicket(existing.ticketId, tx);
      if (!ticket) throw new NotFoundException('Ticket was not found');
      const handoff = await this.handoffsRepository.findByIdForUpdate(handoffId, tx);
      if (!handoff) throw new NotFoundException('Handoff request was not found');
      const participant = await this.handoffsRepository.findUser(actor.userId, tx);
      if (!participant) throw new NotFoundException('User was not found');

      if (status === HandoffStatus.REJECTED) {
        this.handoffPolicy.assertReject(handoff, participant);
      } else {
        this.handoffPolicy.assertCancel(handoff, ticket, participant);
      }

      const now = new Date();
      await this.handoffsRepository.updateStatus(handoffId, status, now, tx);
      await this.ticketEventsRepository.append(
        {
          ticketId: ticket.ticketId,
          userId: actor.userId,
          action: TicketEventAction.HANDOFF,
          details: {
            handoffId,
            requesterId: handoff.requesterId,
            requestedAgentId: handoff.requestedAgentId,
            action: status === HandoffStatus.REJECTED ? 'REJECTED' : 'CANCELLED',
            timestamp: now.toISOString(),
          },
          createdAt: now,
        },
        tx,
      );
    });

    const resolved = await this.handoffsRepository.findById(handoffId);
    if (!resolved) throw new NotFoundException('Handoff request was not found');
    return this.toResponse(resolved);
  }

  private toResponse(handoff: HandoffRecord): HandoffResponse {
    return {
      handoffId: handoff.handoffId,
      status: handoff.status,
      message: handoff.message,
      createdAt: handoff.createdAt,
      updatedAt: handoff.updatedAt,
      resolvedAt: handoff.resolvedAt,
      ticket: {
        ticketId: handoff.ticket.ticketId,
        ticketCode: handoff.ticket.ticketCode,
        title: handoff.ticket.title,
        status: handoff.ticket.status,
        active: handoff.ticket.active,
        department: handoff.ticket.department,
        currentAgent: handoff.ticket.agent
          ? this.toUserSummary(handoff.ticket.agent)
          : null,
      },
      requester: this.toUserSummary(handoff.requester),
      requestedAgent: this.toUserSummary(handoff.requestedAgent),
    };
  }

  private toUserSummary(user: {
    userId: string;
    fullName: string;
    email: string;
    role: UserRole;
    isActive: boolean;
  }): HandoffUserSummary {
    return {
      userId: user.userId,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
  }
}
