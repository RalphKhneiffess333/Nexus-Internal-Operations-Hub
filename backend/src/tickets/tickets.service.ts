import { Injectable, StreamableFile } from '@nestjs/common';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import type { UploadedFileInput } from '../files/file-validation';
import { CloseTicketDto } from './dto/close-ticket.dto';
import { ModifyTicketDto } from './dto/modify-ticket.dto';
import { ReopenTicketDto } from './dto/reopen-ticket.dto';
import { SubmitTicketDto } from './dto/submit-ticket.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import type { TicketEventRecord } from './events/ticket-event.types';
import { TicketLifecycleService } from './ticket-lifecycle.service';
import { TicketQueryService } from './ticket-query.service';
import { TicketWithPermissions } from './ticket-response.mapper';

export type {
  TicketActionPermissions,
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

  findAll(
    actor: AuthenticatedRequestUser,
    filters: TicketQueryDto = {},
  ): Promise<TicketWithPermissions[]> {
    return this.ticketQueryService.findAll(actor, filters);
  }

  findSubmitted(
    actor: AuthenticatedRequestUser,
    filters: TicketQueryDto = {},
  ): Promise<TicketWithPermissions[]> {
    return this.ticketQueryService.findSubmitted(actor, filters);
  }

  findClaimed(
    actor: AuthenticatedRequestUser,
    filters: TicketQueryDto = {},
  ): Promise<TicketWithPermissions[]> {
    return this.ticketQueryService.findClaimed(actor, filters);
  }

  findResolved(
    actor: AuthenticatedRequestUser,
    filters: TicketQueryDto = {},
  ): Promise<TicketWithPermissions[]> {
    return this.ticketQueryService.findResolved(actor, filters);
  }

  findDepartmentTickets(
    actor: AuthenticatedRequestUser,
    filters: TicketQueryDto = {},
  ): Promise<TicketWithPermissions[]> {
    return this.ticketQueryService.findDepartmentTickets(actor, filters);
  }

  findPool(
    actor: AuthenticatedRequestUser,
    filters: TicketQueryDto = {},
  ): Promise<TicketWithPermissions[]> {
    return this.ticketQueryService.findPool(actor, filters);
  }

  findOne(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions> {
    return this.ticketQueryService.findOne(ticketId, actor);
  }

  findEvents(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketEventRecord[]> {
    return this.ticketQueryService.findEvents(ticketId, actor);
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
