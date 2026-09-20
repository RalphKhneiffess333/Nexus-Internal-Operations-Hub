import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { HandoffStatus, TicketEventAction } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../../authentication/request-user';
import { EmailNotificationsService } from '../../notifications/email-notifications.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { TicketEventsRepository } from '../events/ticket-events.repository';
import { TicketRealtimePublisher } from '../realtime/ticket-realtime.publisher';
import { TicketsRepository } from '../repositories/tickets.repository';
import { CreateHandoffDto } from './handoff.dto';
import { HandoffCancellationService } from './handoff-cancellation.service';
import { HandoffPolicy } from './handoff.policy';
import {
  HandoffResponse,
  HandoffResponseMapper,
} from './handoff-response.mapper';
import { HandoffsRepository, HandoffRecord } from './handoffs.repository';
import { sanitizePlainText } from '../../common/sanitization/content-sanitizer';

@Injectable()
export class HandoffLifecycleService {
  constructor(
    private readonly handoffsRepository: HandoffsRepository,
    private readonly ticketEventsRepository: TicketEventsRepository,
    private readonly ticketsRepository: TicketsRepository,
    private readonly handoffPolicy: HandoffPolicy,
    private readonly ticketRealtimePublisher: TicketRealtimePublisher,
    private readonly notifications: NotificationsService,
    private readonly emailNotifications: EmailNotificationsService,
    private readonly handoffResponseMapper: HandoffResponseMapper,
    private readonly handoffCancellationService: HandoffCancellationService,
  ) {}

  async create(
    ticketId: string,
    dto: CreateHandoffDto,
    actor: AuthenticatedRequestUser,
  ): Promise<HandoffResponse> {
    let createdHandoffId = '';
    let ticketEventId = '';
    let occurredAt = '';

    await this.handoffsRepository.transaction(async (tx) => {
      const ticket = await this.handoffsRepository.lockTicket(ticketId, tx);
      if (!ticket) throw new NotFoundException('Ticket was not found');

      const [requester, requestedAgent] = await Promise.all([
        this.handoffsRepository.findUser(actor.userId, tx),
        this.handoffsRepository.findUser(dto.requestedAgentId, tx),
      ]);
      if (!requester) throw new NotFoundException('Requester was not found');
      if (!requestedAgent) {
        throw new NotFoundException('Requested agent was not found');
      }

      const [requesterInDepartment, requestedAgentInDepartment] =
        await Promise.all([
          this.handoffsRepository.isActiveMember(
            requester.userId,
            ticket.departmentId,
            tx,
          ),
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
        throw new ConflictException(
          'A pending handoff already exists for this agent',
        );
      }

      const now = new Date();
      const handoff = await this.handoffsRepository.create(
        {
          handoffId: randomUUID(),
          ticketId,
          requesterId: requester.userId,
          requestedAgentId: requestedAgent.userId,
          status: HandoffStatus.PENDING,
          message: dto.message ? sanitizePlainText(dto.message) || null : null,
          createdAt: now,
          updatedAt: now,
          resolvedAt: null,
        },
        tx,
      );
      createdHandoffId = handoff.handoffId;
      ticketEventId = await this.ticketEventsRepository.append(
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
      occurredAt = now.toISOString();
    });

    this.ticketRealtimePublisher.publishTicketEvent(
      ticketId,
      ticketEventId,
      actor.userId,
      TicketEventAction.HANDOFF,
      occurredAt,
    );

    const created = await this.handoffsRepository.findById(createdHandoffId);
    if (!created) throw new NotFoundException('Handoff request was not found');
    this.notifications.notify({
      type: 'HANDOFF_REQUESTED',
      message: `You have a pending ticket handoff request for ticket ${created.ticket.ticketCode}.`,
      recipientUserIds: [created.requestedAgent.userId],
      ticketId: created.ticket.ticketId,
      link: '/tickets/handoffs',
    });
    void this.emailNotifications.notifyHandoffRequested(created.handoffId);
    return this.handoffResponseMapper.toResponse(created);
  }

  async accept(
    handoffId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<HandoffResponse> {
    const existing = await this.handoffsRepository.findById(handoffId);
    if (!existing) throw new NotFoundException('Handoff request was not found');

    let ticketEventId = '';
    let occurredAt = '';
    await this.handoffsRepository.transaction(async (tx) => {
      const ticket = await this.handoffsRepository.lockTicket(
        existing.ticketId,
        tx,
      );
      if (!ticket) throw new NotFoundException('Ticket was not found');

      const handoff = await this.handoffsRepository.findByIdForUpdate(
        handoffId,
        tx,
      );
      if (!handoff) {
        throw new NotFoundException('Handoff request was not found');
      }

      const [requester, requestedAgent, authenticatedActor] = await Promise.all(
        [
          this.handoffsRepository.findUser(handoff.requesterId, tx),
          this.handoffsRepository.findUser(handoff.requestedAgentId, tx),
          this.handoffsRepository.findUser(actor.userId, tx),
        ],
      );
      if (!requester || !requestedAgent || !authenticatedActor) {
        throw new ConflictException(
          'Handoff participants are no longer available',
        );
      }

      const [requesterInDepartment, requestedAgentInDepartment] =
        await Promise.all([
          this.handoffsRepository.isActiveMember(
            requester.userId,
            ticket.departmentId,
            tx,
          ),
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
        authenticatedActor,
        requesterInDepartment,
        requestedAgentInDepartment,
      );

      const now = new Date();
      await this.ticketsRepository.transferClaimed(
        ticket.ticketId,
        requestedAgent.userId,
        now,
        tx,
      );
      await this.handoffsRepository.updateStatus(
        handoffId,
        HandoffStatus.ACCEPTED,
        now,
        tx,
      );
      ticketEventId = await this.ticketEventsRepository.append(
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
      occurredAt = now.toISOString();
      await this.handoffCancellationService.cancelPendingForTicket(
        ticket.ticketId,
        actor.userId,
        'SUPERSEDED_BY_ACCEPTANCE',
        tx,
      );
    });

    const transferredTicket = await this.ticketsRepository.findById(
      existing.ticketId,
    );
    if (transferredTicket) {
      this.ticketRealtimePublisher.publishMutation(
        transferredTicket,
        ticketEventId,
        actor.userId,
        TicketEventAction.HANDOFF,
      );
    } else {
      this.ticketRealtimePublisher.publishTicketEvent(
        existing.ticketId,
        ticketEventId,
        actor.userId,
        TicketEventAction.HANDOFF,
        occurredAt,
      );
    }

    const accepted = await this.handoffsRepository.findById(handoffId);
    if (!accepted) throw new NotFoundException('Handoff request was not found');
    this.notifications.notify({
      type: 'HANDOFF_RESOLVED',
      message: `Your handoff request for ticket ${accepted.ticket.ticketCode} was accepted.`,
      recipientUserIds: [accepted.requester.userId],
      ticketId: accepted.ticket.ticketId,
      link: '/tickets/handoffs',
    });
    void this.emailNotifications.notifyHandoffAccepted(accepted.handoffId);
    return this.handoffResponseMapper.toResponse(accepted);
  }

  reject(
    handoffId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<HandoffResponse> {
    return this.resolve(handoffId, actor, HandoffStatus.REJECTED);
  }

  cancel(
    handoffId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<HandoffResponse> {
    return this.resolve(handoffId, actor, HandoffStatus.CANCELLED);
  }

  private async resolve(
    handoffId: string,
    actor: AuthenticatedRequestUser,
    status: Extract<HandoffStatus, 'REJECTED' | 'CANCELLED'>,
  ): Promise<HandoffResponse> {
    const existing = await this.handoffsRepository.findById(handoffId);
    if (!existing) throw new NotFoundException('Handoff request was not found');

    let ticketEventId = '';
    let occurredAt = '';
    await this.handoffsRepository.transaction(async (tx) => {
      const ticket = await this.handoffsRepository.lockTicket(
        existing.ticketId,
        tx,
      );
      if (!ticket) throw new NotFoundException('Ticket was not found');

      const handoff = await this.handoffsRepository.findByIdForUpdate(
        handoffId,
        tx,
      );
      if (!handoff) {
        throw new NotFoundException('Handoff request was not found');
      }

      const participant = await this.handoffsRepository.findUser(
        actor.userId,
        tx,
      );
      if (!participant) throw new NotFoundException('User was not found');

      if (status === HandoffStatus.REJECTED) {
        this.handoffPolicy.assertReject(handoff, participant);
      } else {
        this.handoffPolicy.assertCancel(handoff, ticket, participant);
      }

      const now = new Date();
      await this.handoffsRepository.updateStatus(handoffId, status, now, tx);
      ticketEventId = await this.ticketEventsRepository.append(
        {
          ticketId: ticket.ticketId,
          userId: actor.userId,
          action: TicketEventAction.HANDOFF,
          details: {
            handoffId,
            requesterId: handoff.requesterId,
            requestedAgentId: handoff.requestedAgentId,
            action:
              status === HandoffStatus.REJECTED ? 'REJECTED' : 'CANCELLED',
            timestamp: now.toISOString(),
          },
          createdAt: now,
        },
        tx,
      );
      occurredAt = now.toISOString();
    });

    this.ticketRealtimePublisher.publishTicketEvent(
      existing.ticketId,
      ticketEventId,
      actor.userId,
      TicketEventAction.HANDOFF,
      occurredAt,
    );

    const resolved = await this.handoffsRepository.findById(handoffId);
    if (!resolved) throw new NotFoundException('Handoff request was not found');
    if (status === HandoffStatus.REJECTED) {
      this.notifications.notify({
        type: 'HANDOFF_RESOLVED',
        message: `Your handoff request for ticket ${resolved.ticket.ticketCode} was denied.`,
        recipientUserIds: [resolved.requester.userId],
        ticketId: resolved.ticket.ticketId,
        link: '/tickets/handoffs',
      });
      void this.emailNotifications.notifyHandoffRejected(resolved.handoffId);
    }
    return this.handoffResponseMapper.toResponse(resolved);
  }
}
