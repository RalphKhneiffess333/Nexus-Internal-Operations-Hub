import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../../authentication/request-user';
import { CreateHandoffDto, HandoffQueryDto } from './handoff.dto';
import { HandoffCancellationService } from './handoff-cancellation.service';
import { HandoffLifecycleService } from './handoff-lifecycle.service';
import { HandoffQueryService } from './handoff-query.service';

export type {
  HandoffListPageResponse,
  HandoffListResponse,
  HandoffResponse,
  HandoffUserSummary,
} from './handoff-response.mapper';
import type {
  HandoffListPageResponse,
  HandoffResponse,
  HandoffUserSummary,
} from './handoff-response.mapper';

@Injectable()
export class HandoffsService {
  constructor(
    private readonly handoffQueryService: HandoffQueryService,
    private readonly handoffLifecycleService: HandoffLifecycleService,
    private readonly handoffCancellationService: HandoffCancellationService,
  ) {}

  list(
    actor: AuthenticatedRequestUser,
    direction: 'incoming' | 'outgoing' | 'all',
    query: HandoffQueryDto,
  ): Promise<HandoffListPageResponse> {
    return this.handoffQueryService.list(actor, direction, query);
  }

  listForTicket(
    ticketId: string,
    actor: AuthenticatedRequestUser,
    query: HandoffQueryDto = {},
  ): Promise<HandoffListPageResponse> {
    return this.handoffQueryService.listForTicket(ticketId, actor, query);
  }

  listParticipants(
    actor: AuthenticatedRequestUser,
  ): Promise<HandoffUserSummary[]> {
    return this.handoffQueryService.listParticipants(actor);
  }

  listEligibleAgents(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<HandoffUserSummary[]> {
    return this.handoffQueryService.listEligibleAgents(ticketId, actor);
  }

  create(
    ticketId: string,
    dto: CreateHandoffDto,
    actor: AuthenticatedRequestUser,
  ): Promise<HandoffResponse> {
    return this.handoffLifecycleService.create(ticketId, dto, actor);
  }

  accept(
    handoffId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<HandoffResponse> {
    return this.handoffLifecycleService.accept(handoffId, actor);
  }

  reject(
    handoffId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<HandoffResponse> {
    return this.handoffLifecycleService.reject(handoffId, actor);
  }

  cancel(
    handoffId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<HandoffResponse> {
    return this.handoffLifecycleService.cancel(handoffId, actor);
  }

  cancelPendingForTicket(
    ticketId: string,
    actorId: string,
    reason: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    return this.handoffCancellationService.cancelPendingForTicket(
      ticketId,
      actorId,
      reason,
      client,
    );
  }

  cancelPendingForUserInDepartment(
    userId: string,
    departmentId: string,
    actorId: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    return this.handoffCancellationService.cancelPendingForUserInDepartment(
      userId,
      departmentId,
      actorId,
      client,
    );
  }

  cancelPendingForUser(
    userId: string,
    actorId: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    return this.handoffCancellationService.cancelPendingForUser(
      userId,
      actorId,
      client,
    );
  }
}
