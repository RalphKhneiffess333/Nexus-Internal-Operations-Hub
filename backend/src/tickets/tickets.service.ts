import { Injectable, StreamableFile } from '@nestjs/common';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import type { UploadedFileInput } from '../files/file-validation';
import { CloseTicketDto } from './dto/close-ticket.dto';
import { ModifyTicketDto } from './dto/modify-ticket.dto';
import { ReopenTicketDto } from './dto/reopen-ticket.dto';
import { SubmitTicketDto } from './dto/submit-ticket.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import { TicketEventQueryDto } from './dto/ticket-event-query.dto';
import type { TicketEventRecord } from './events/ticket-event.types';
import { TicketLifecycleService } from './ticket-lifecycle.service';
import { TicketQueryService } from './ticket-query.service';
import type {
  TicketChatContextResponse,
  TicketListWithPermissions,
  TicketUserReference,
  TicketWithPermissions,
} from './ticket-response.mapper';

export type {
  TicketActionPermissions,
  TicketChatContextResponse,
  TicketListWithPermissions,
  TicketUserReference,
  TicketUserProfile,
  TicketWithPermissions,
} from './ticket-response.mapper';

/** Stable ticket application façade for controllers, gateways, and consumers. */
@Injectable()
export class TicketsService {
  constructor(
    private readonly ticketQueryService: TicketQueryService,
    private readonly ticketLifecycleService: TicketLifecycleService,
  ) {}

  list(
    actor: AuthenticatedRequestUser,
    filters: TicketQueryDto = {},
  ): Promise<TicketListWithPermissions[]> {
    return this.ticketQueryService.list(actor, filters);
  }

  listPage(actor: AuthenticatedRequestUser, filters: TicketQueryDto = {}) {
    return this.ticketQueryService.listPage(actor, filters);
  }

  countPool(actor: AuthenticatedRequestUser): Promise<{ count: number }> {
    return this.ticketQueryService.countPool(actor);
  }

  findOne(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions> {
    return this.ticketQueryService.findOne(ticketId, actor);
  }

  findOneByCode(
    ticketCode: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions> {
    return this.ticketQueryService.findOneByCode(ticketCode, actor);
  }

  findChatContext(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketChatContextResponse> {
    return this.ticketQueryService.findChatContext(ticketId, actor);
  }

  findEvents(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketEventRecord[]> {
    return this.ticketQueryService.findEvents(ticketId, actor);
  }

  findEventSummaries(
    ticketId: string,
    actor: AuthenticatedRequestUser,
    query?: TicketEventQueryDto,
  ) {
    return this.ticketQueryService.findEventSummaries(ticketId, actor, query);
  }

  findAttachments(ticketId: string, actor: AuthenticatedRequestUser) {
    return this.ticketQueryService.findAttachments(ticketId, actor);
  }

  findEvent(
    ticketId: string,
    ticketEventId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketEventRecord> {
    return this.ticketQueryService.findEvent(ticketId, ticketEventId, actor);
  }

  downloadAttachment(
    ticketId: string,
    eventId: string,
    attachmentId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<StreamableFile> {
    return this.ticketQueryService.downloadAttachment(
      ticketId,
      eventId,
      attachmentId,
      actor,
    );
  }

  submit(
    dto: SubmitTicketDto,
    actor: AuthenticatedRequestUser,
    files?: UploadedFileInput[],
  ): Promise<TicketWithPermissions> {
    return this.ticketLifecycleService.submit(dto, actor, files);
  }

  claim(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions> {
    return this.ticketLifecycleService.claim(ticketId, actor);
  }

  close(
    ticketId: string,
    dto: CloseTicketDto,
    actor: AuthenticatedRequestUser,
    files?: UploadedFileInput[],
  ): Promise<TicketWithPermissions> {
    return this.ticketLifecycleService.close(ticketId, dto, actor, files);
  }

  reopen(
    ticketId: string,
    dto: ReopenTicketDto,
    actor: AuthenticatedRequestUser,
    files?: UploadedFileInput[],
  ): Promise<TicketWithPermissions> {
    return this.ticketLifecycleService.reopen(ticketId, dto, actor, files);
  }

  modify(
    ticketId: string,
    dto: ModifyTicketDto,
    actor: AuthenticatedRequestUser,
    files?: UploadedFileInput[],
  ): Promise<TicketWithPermissions> {
    return this.ticketLifecycleService.modify(ticketId, dto, actor, files);
  }

  cancel(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions> {
    return this.ticketLifecycleService.cancel(ticketId, actor);
  }
}
