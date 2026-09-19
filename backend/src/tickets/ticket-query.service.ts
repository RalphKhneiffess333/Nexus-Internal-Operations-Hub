import { Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { FileAttachmentsRepository } from '../files/file-attachments.repository';
import { FilesService } from '../files/files.service';
import { TicketQueryDto } from './dto/ticket-query.dto';
import type { TicketEventRecord } from './events/ticket-event.types';
import { TicketEventsRepository } from './events/ticket-events.repository';
import { ViewTicketPolicy } from './policies/view-ticket.policy';
import {
  TicketResponseMapper,
  TicketWithPermissions,
} from './ticket-response.mapper';
import { TicketAccessService } from './ticket-access.service';
import type { TicketRecord } from './repositories/tickets.repository';
import { TicketsRepository } from './repositories/tickets.repository';

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

  async findAll(
    actor: AuthenticatedRequestUser,
    filters: TicketQueryDto = {},
  ): Promise<TicketWithPermissions[]> {
    const tickets = await this.ticketsRepository.findAll(filters);
    const actorDepartmentIds =
      await this.ticketAccess.getActorDepartmentIds(actor);
    const canIncludeInactive =
      actor.role === UserRole.Admin && filters.includeInactive === true;

    return this.ticketResponseMapper.withPermissions(
      tickets.filter(
        (ticket) =>
          (ticket.active || canIncludeInactive) &&
          this.viewTicketPolicy.canView(actor, ticket, actorDepartmentIds),
      ),
      actor,
      actorDepartmentIds,
    );
  }

  async findSubmitted(
    actor: AuthenticatedRequestUser,
    filters: TicketQueryDto = {},
  ): Promise<TicketWithPermissions[]> {
    const tickets = await this.ticketsRepository.findActiveBySubmitter(
      actor.userId,
      filters,
    );
    return this.mapTickets(tickets, actor);
  }

  async findClaimed(
    actor: AuthenticatedRequestUser,
    filters: TicketQueryDto = {},
  ): Promise<TicketWithPermissions[]> {
    const tickets = await this.ticketsRepository.findActiveByAgent(
      actor.userId,
      filters,
    );
    return this.mapTickets(tickets, actor);
  }

  async findResolved(
    actor: AuthenticatedRequestUser,
    filters: TicketQueryDto = {},
  ): Promise<TicketWithPermissions[]> {
    const tickets = await this.ticketsRepository.findActiveResolvedByAgent(
      actor.userId,
      filters,
    );
    return this.mapTickets(tickets, actor);
  }

  async findDepartmentTickets(
    actor: AuthenticatedRequestUser,
    filters: TicketQueryDto = {},
  ): Promise<TicketWithPermissions[]> {
    const actorDepartmentIds =
      await this.ticketAccess.getActorDepartmentIds(actor);
    const tickets = await this.ticketsRepository.findActiveByDepartmentIds(
      actorDepartmentIds,
      filters,
    );
    return this.ticketResponseMapper.withPermissions(
      tickets,
      actor,
      actorDepartmentIds,
    );
  }

  async findPool(
    actor: AuthenticatedRequestUser,
    filters: TicketQueryDto = {},
  ): Promise<TicketWithPermissions[]> {
    const actorDepartmentIds =
      await this.ticketAccess.getActorDepartmentIds(actor);
    const tickets = await this.ticketsRepository.findTicketPool(
      actorDepartmentIds,
      filters,
    );
    return this.ticketResponseMapper.withPermissions(
      tickets,
      actor,
      actorDepartmentIds,
    );
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

  async findEvents(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketEventRecord[]> {
    await this.ticketAccess.assertCanViewTicket(ticketId, actor);
    return this.ticketEventsRepository.findByTicketId(ticketId);
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

  private async mapTickets(
    tickets: TicketRecord[],
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions[]> {
    const actorDepartmentIds =
      await this.ticketAccess.getActorDepartmentIds(actor);
    return this.ticketResponseMapper.withPermissions(
      tickets,
      actor,
      actorDepartmentIds,
    );
  }
}
