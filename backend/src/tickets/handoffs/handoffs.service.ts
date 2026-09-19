import { Injectable } from '@nestjs/common';
import type { HandoffStatus, Prisma } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../../authentication/request-user';
import { CreateHandoffDto, HandoffQueryDto } from './handoff.dto';
import { HandoffCancellationService } from './handoff-cancellation.service';
import { HandoffLifecycleService } from './handoff-lifecycle.service';
import { HandoffQueryService } from './handoff-query.service';

export type {
  HandoffResponse,
  HandoffUserSummary,
} from './handoff-response.mapper';
import type {
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
  ): Promise<HandoffResponse[]> {
    return this.handoffQueryService.list(actor, direction, query);
  }

  listForTicket(
    ticketId: string,
    actor: AuthenticatedRequestUser,
    status?: HandoffStatus,
  ): Promise<HandoffResponse[]> {
    return this.handoffQueryService.listForTicket(ticketId, actor, status);
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
