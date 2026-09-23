import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { FileAttachmentsRepository } from '../files/file-attachments.repository';
import { FilesService } from '../files/files.service';
import { TicketListScope, TicketQueryDto } from './dto/ticket-query.dto';
import { TicketEventQueryDto } from './dto/ticket-event-query.dto';
import type { TicketEventRecord } from './events/ticket-event.types';
import { TicketEventsRepository } from './events/ticket-events.repository';
import { ViewTicketPolicy } from './policies/view-ticket.policy';
import {
  TicketListWithPermissions,
  TicketChatContextResponse,
  TicketResponseMapper,
  TicketWithPermissions,
} from './ticket-response.mapper';
import { TicketAccessService } from './ticket-access.service';
import type { TicketRecord } from './repositories/tickets.repository';
import {
  TicketsRepository,
  type TicketListPage,
} from './repositories/tickets.repository';

@Injectable()
export class TicketQueryService {
  constructor(
    private readonly ticketsRepository: TicketsRepository,
    private readonly ticketEventsRepository: TicketEventsRepository,
    private readonly fileAttachmentsRepository: FileAttachmentsRepository,
    private readonly filesService: FilesService,
    private readonly viewTicketPolicy: ViewTicketPolicy,
    private readonly ticketResponseMapper: TicketResponseMapper,
    private readonly ticketAccess: TicketAccessService,
  ) {}

  async list(
    actor: AuthenticatedRequestUser,
    filters: TicketQueryDto = {},
  ): Promise<TicketListWithPermissions[]> {
    const result = await this.listPage(actor, filters);
    return result.items;
  }

  async listPage(
    actor: AuthenticatedRequestUser,
    filters: TicketQueryDto = {},
  ): Promise<{
    items: TicketListWithPermissions[];
    page: number;
    pageSize: number;
    hasMore: boolean;
  }> {
    const scope = filters.scope ?? TicketListScope.ALL;
    if (
      actor.role === UserRole.Employee &&
      [
        TicketListScope.CLAIMED,
        TicketListScope.RESOLVED,
        TicketListScope.DEPARTMENT,
        TicketListScope.POOL,
      ].includes(scope)
    ) {
      throw new ForbiddenException('This ticket view is not available');
    }
    const actorDepartmentIds =
      await this.ticketAccess.getActorDepartmentIds(actor);
    const result: TicketListPage = await this.ticketsRepository.findList(
      scope,
      actor.userId,
      actor.role,
      actorDepartmentIds,
      filters,
    );
    return {
      ...result,
      items: this.ticketResponseMapper.withListPermissions(
        result.items,
        actor,
        actorDepartmentIds,
      ),
    };
  }

  async countPool(actor: AuthenticatedRequestUser): Promise<{ count: number }> {
    const actorDepartmentIds =
      await this.ticketAccess.getActorDepartmentIds(actor);
    return { count: await this.ticketsRepository.countPool(actorDepartmentIds) };
  }

  async findOne(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions> {
    const ticket = await this.ticketAccess.getTicketForView(ticketId, actor);
    const actorDepartmentIds =
      await this.ticketAccess.getActorDepartmentIds(actor);
    this.viewTicketPolicy.assert(actor, ticket, actorDepartmentIds);
    return this.ticketResponseMapper.withPermission(
      ticket,
      actor,
      actorDepartmentIds,
    );
  }

  async findOneByCode(
    ticketCode: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions> {
    const ticket = await this.ticketAccess.assertCanViewTicketByCode(
      ticketCode,
      actor,
    );
    const actorDepartmentIds =
      await this.ticketAccess.getActorDepartmentIds(actor);
    return this.ticketResponseMapper.withPermission(
      ticket,
      actor,
      actorDepartmentIds,
    );
  }

  async findChatContext(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketChatContextResponse> {
    const ticket = await this.ticketAccess.getTicketChatContext(
      ticketId,
      actor,
    );
    return {
      ticketId: ticket.ticketId,
      ticketCode: ticket.ticketCode,
      title: ticket.title,
      status: ticket.status,
      active: ticket.active,
      submittedBy: {
        userId: ticket.submittedBy,
        fullName: ticket.submitter.fullName,
      },
      agent: ticket.agentId && ticket.agent
        ? { userId: ticket.agentId, fullName: ticket.agent.fullName }
        : null,
    };
  }

  async findEvents(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketEventRecord[]> {
    await this.ticketAccess.assertCanViewTicket(ticketId, actor);
    return this.ticketEventsRepository.findByTicketId(ticketId);
  }

  async findEventSummaries(
    ticketId: string,
    actor: AuthenticatedRequestUser,
    query: TicketEventQueryDto = new TicketEventQueryDto(),
  ) {
    await this.ticketAccess.assertCanViewTicket(ticketId, actor);
    return this.ticketEventsRepository.findSummariesByTicketId(
      ticketId,
      query.page,
      query.pageSize,
    );
  }

  async findAttachments(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ) {
    await this.ticketAccess.assertCanViewTicket(ticketId, actor);
    return this.ticketEventsRepository.findLatestAttachmentEventByTicketId(
      ticketId,
    );
  }

  async findEvent(
    ticketId: string,
    ticketEventId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketEventRecord> {
    await this.ticketAccess.assertCanViewTicket(ticketId, actor);
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

  async downloadAttachment(
    ticketId: string,
    eventId: string,
    attachmentId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<StreamableFile> {
    await this.ticketAccess.assertCanViewTicket(ticketId, actor);
    const attachment = await this.fileAttachmentsRepository.findForTicketEvent(
      ticketId,
      eventId,
      attachmentId,
    );
    if (!attachment) {
      throw new NotFoundException('Attachment was not found');
    }

    const contents = await this.filesService.read(attachment.storageKey);

    return new StreamableFile(contents, {
      type: attachment.mimeType,
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
    });
  }

}
