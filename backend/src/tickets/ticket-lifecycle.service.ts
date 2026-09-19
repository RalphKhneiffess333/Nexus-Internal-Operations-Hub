import { BadRequestException, Injectable } from '@nestjs/common';
import { TicketEventAction, TicketStatus, UserRole } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { DepartmentsRepository } from '../departments/repositories/departments.repository';
import {
  FileAttachmentsRepository,
  type StoredFileMetadata,
} from '../files/file-attachments.repository';
import { FilesService } from '../files/files.service';
import type { UploadedFileInput } from '../files/file-validation';
import { CloseTicketDto } from './dto/close-ticket.dto';
import { ModifyTicketDto } from './dto/modify-ticket.dto';
import { ReopenTicketDto } from './dto/reopen-ticket.dto';
import { SubmitTicketDto } from './dto/submit-ticket.dto';
import { CancelTicketPolicy } from './policies/cancel-ticket.policy';
import { ClaimTicketPolicy } from './policies/claim-ticket.policy';
import { CloseTicketPolicy } from './policies/close-ticket.policy';
import { ModifyTicketPolicy } from './policies/modify-ticket.policy';
import { ReopenTicketPolicy } from './policies/reopen-ticket.policy';
import { SubmitTicketPolicy } from './policies/submit-ticket.policy';
import { TicketLifecycleRepository } from './repositories/ticket-lifecycle.repository';
import { TicketRealtimePublisher } from './realtime/ticket-realtime.publisher';
import { TicketAccessService } from './ticket-access.service';
import { TicketNotificationService } from './ticket-notification.service';
import {
  TicketResponseMapper,
  TicketWithPermissions,
} from './ticket-response.mapper';
import type { TicketRecord } from './repositories/tickets.repository';

@Injectable()
export class TicketLifecycleService {
  constructor(
    private readonly ticketLifecycleRepository: TicketLifecycleRepository,
    private readonly departmentsRepository: DepartmentsRepository,
    private readonly filesService: FilesService,
    private readonly fileAttachmentsRepository: FileAttachmentsRepository,
    private readonly submitTicketPolicy: SubmitTicketPolicy,
    private readonly claimTicketPolicy: ClaimTicketPolicy,
    private readonly closeTicketPolicy: CloseTicketPolicy,
    private readonly reopenTicketPolicy: ReopenTicketPolicy,
    private readonly modifyTicketPolicy: ModifyTicketPolicy,
    private readonly cancelTicketPolicy: CancelTicketPolicy,
    private readonly ticketRealtimePublisher: TicketRealtimePublisher,
    private readonly ticketResponseMapper: TicketResponseMapper,
    private readonly ticketNotifications: TicketNotificationService,
    private readonly ticketAccess: TicketAccessService,
  ) {}

  async submit(
    dto: SubmitTicketDto,
    actor: AuthenticatedRequestUser,
    files?: UploadedFileInput[],
  ): Promise<TicketWithPermissions> {
    const department = await this.departmentsRepository.findById(
      dto.departmentId,
    );
    this.submitTicketPolicy.assert(department, actor.role);

    const mutation = await this.withStoredFiles(
      files,
      actor.userId,
      async (storedFiles) => {
        const now = new Date();
        return this.ticketLifecycleRepository.createWithEvent(
          {
            title: dto.title,
            description: dto.description,
            priority: dto.priority,
            status: TicketStatus.OPEN,
            departmentId: dto.departmentId,
            submittedBy: actor.userId,
            agentId: null,
            active: true,
            completionNotes: null,
            createdAt: now,
            updatedAt: now,
            closedAt: null,
            unclaimedSince: now,
            lastReminderAt: null,
          },
          {
            userId: actor.userId,
            action: TicketEventAction.SUBMISSION,
            details: {
              title: dto.title,
              departmentId: dto.departmentId,
              priority: dto.priority,
              description: dto.description,
              submitterId: actor.userId,
            },
            createdAt: now,
          },
          storedFiles,
        );
      },
    );
    this.ticketRealtimePublisher.publishMutation(
      mutation.ticket,
      mutation.ticketEventId,
      actor.userId,
      TicketEventAction.SUBMISSION,
    );
    await this.ticketNotifications.notifyLifecycle(
      mutation.ticket,
      TicketEventAction.SUBMISSION,
      actor.userId,
    );
    this.ticketNotifications.notifyEmail(
      mutation.ticket,
      TicketEventAction.SUBMISSION,
      actor,
    );
    return this.mapMutation(mutation.ticket, actor);
  }

  async claim(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions> {
    const ticket = await this.ticketAccess.getActiveTicket(ticketId);
    const actorDepartmentIds =
      await this.ticketAccess.getActorDepartmentIds(actor);
    this.claimTicketPolicy.assert(ticket, actor, actorDepartmentIds);

    const now = new Date();
    const claimed = await this.ticketLifecycleRepository.claimWithEvent(
      ticketId,
      actor.userId,
      {
        ticketId,
        userId: actor.userId,
        action: TicketEventAction.CLAIM,
        details: {
          agentId: actor.userId,
          timestamp: now.toISOString(),
        },
        createdAt: now,
      },
    );
    if (!claimed) {
      throw new BadRequestException(
        'A ticket cannot be claimed if it already has an assigned agent',
      );
    }

    this.ticketRealtimePublisher.publishMutation(
      claimed.ticket,
      claimed.ticketEventId,
      actor.userId,
      TicketEventAction.CLAIM,
    );
    this.ticketNotifications.notifySubmitter(
      claimed.ticket,
      actor.userId,
      'TICKET_CLAIMED',
      `Your ticket ${claimed.ticket.ticketCode} has been claimed.`,
    );
    this.ticketNotifications.notifyEmail(
      claimed.ticket,
      TicketEventAction.CLAIM,
      actor,
    );
    return this.ticketResponseMapper.withPermission(
      claimed.ticket,
      actor,
      actorDepartmentIds,
    );
  }

  async close(
    ticketId: string,
    dto: CloseTicketDto,
    actor: AuthenticatedRequestUser,
    files?: UploadedFileInput[],
  ): Promise<TicketWithPermissions> {
    const ticket = await this.ticketAccess.getActiveTicket(ticketId);
    this.closeTicketPolicy.assert(ticket, actor);
    const adminCloseOverride =
      actor.role === UserRole.Admin && ticket.agentId !== actor.userId;

    const mutation = await this.withStoredFiles(
      files,
      actor.userId,
      async (storedFiles) => {
        const now = new Date();
        ticket.status = TicketStatus.CLOSED;
        ticket.agentId = null;
        ticket.unclaimedSince = null;
        ticket.lastReminderAt = null;
        ticket.completionNotes = adminCloseOverride
          ? [
              `This ticket was closed by administrator ${actor.fullName}.`,
              dto.completionNotes?.trim()
                ? `Administrator's completion notes: ${dto.completionNotes.trim()}`
                : null,
            ]
              .filter((note): note is string => Boolean(note))
              .join('\n')
          : (dto.completionNotes ?? null);
        ticket.closedAt = now;
        ticket.updatedAt = now;
        return this.ticketLifecycleRepository.saveWithEvent(
          ticket,
          {
            ticketId,
            userId: actor.userId,
            action: TicketEventAction.CLOSE,
            details: {
              agentId: actor.userId,
              completionNotes: ticket.completionNotes,
            },
            createdAt: now,
          },
          storedFiles,
          [],
          adminCloseOverride,
        );
      },
    );
    this.ticketRealtimePublisher.publishMutation(
      mutation.ticket,
      mutation.ticketEventId,
      actor.userId,
      TicketEventAction.CLOSE,
    );
    this.ticketNotifications.notifySubmitter(
      mutation.ticket,
      actor.userId,
      'TICKET_CLOSED',
      `Your ticket ${mutation.ticket.ticketCode} has been closed.`,
    );
    this.ticketNotifications.notifyEmail(
      mutation.ticket,
      TicketEventAction.CLOSE,
      actor,
    );
    return this.mapMutation(mutation.ticket, actor);
  }

  async reopen(
    ticketId: string,
    dto: ReopenTicketDto,
    actor: AuthenticatedRequestUser,
    files?: UploadedFileInput[],
  ): Promise<TicketWithPermissions> {
    const ticket = await this.ticketAccess.getActiveTicket(ticketId);
    this.reopenTicketPolicy.assert(ticket, actor);

    const mutation = await this.withStoredFiles(
      files,
      actor.userId,
      async (storedFiles) => {
        const now = new Date();
        ticket.status = TicketStatus.REOPENED;
        ticket.agentId = null;
        ticket.unclaimedSince = now;
        ticket.lastReminderAt = null;
        ticket.closedAt = null;
        if (dto.description) {
          ticket.description = dto.description;
        }
        ticket.updatedAt = now;
        return this.ticketLifecycleRepository.saveWithEvent(
          ticket,
          {
            ticketId,
            userId: actor.userId,
            action: TicketEventAction.REOPEN,
            details: {
              priority: ticket.priority,
              description: ticket.description,
              submitterId: ticket.submittedBy,
            },
            createdAt: now,
          },
          storedFiles,
        );
      },
    );
    this.ticketRealtimePublisher.publishMutation(
      mutation.ticket,
      mutation.ticketEventId,
      actor.userId,
      TicketEventAction.REOPEN,
    );
    await this.ticketNotifications.notifyLifecycle(
      mutation.ticket,
      TicketEventAction.REOPEN,
      actor.userId,
    );
    this.ticketNotifications.notifyEmail(
      mutation.ticket,
      TicketEventAction.REOPEN,
      actor,
    );
    return this.mapMutation(mutation.ticket, actor);
  }

  async modify(
    ticketId: string,
    dto: ModifyTicketDto,
    actor: AuthenticatedRequestUser,
    files?: UploadedFileInput[],
  ): Promise<TicketWithPermissions> {
    const ticket = await this.ticketAccess.getActiveTicket(ticketId);
    const department = dto.departmentId
      ? await this.departmentsRepository.findById(dto.departmentId)
      : null;
    this.modifyTicketPolicy.assert(ticket, actor, dto, department);

    const attachmentIdsToRemove = this.parseRemovedAttachmentIds(
      dto.removedAttachmentIds,
    );
    const filesToRemove = await this.fileAttachmentsRepository.findForTicket(
      ticketId,
      attachmentIdsToRemove,
    );
    if (filesToRemove.length !== attachmentIdsToRemove.length) {
      throw new BadRequestException(
        'One or more attachments do not belong to this ticket',
      );
    }

    const oldTitle = ticket.title;
    const oldDescription = ticket.description;
    const oldPriority = ticket.priority;
    const oldDepartmentId = ticket.departmentId;

    if (dto.departmentId !== undefined) ticket.departmentId = dto.departmentId;
    if (dto.title !== undefined) ticket.title = dto.title;
    if (dto.description !== undefined) ticket.description = dto.description;
    if (dto.priority !== undefined) ticket.priority = dto.priority;

    const changed =
      oldTitle !== ticket.title ||
      oldDescription !== ticket.description ||
      oldPriority !== ticket.priority ||
      oldDepartmentId !== ticket.departmentId;
    const attachmentChanges =
      filesToRemove.length > 0 || (files?.length ?? 0) > 0;
    if (!changed && !attachmentChanges) {
      return this.mapMutation(ticket, actor);
    }

    const now = new Date();
    ticket.updatedAt = now;
    const mutation = await this.withStoredFiles(
      files,
      actor.userId,
      (storedFiles) =>
        this.ticketLifecycleRepository.saveWithEvent(
          ticket,
          {
            ticketId,
            userId: actor.userId,
            action: TicketEventAction.MODIFICATION,
            details: {
              oldTitle,
              newTitle: ticket.title,
              oldDepartmentId,
              newDepartmentId: ticket.departmentId,
              oldPriority,
              newPriority: ticket.priority,
              oldDescription,
              newDescription: ticket.description,
            },
            createdAt: now,
          },
          storedFiles,
          attachmentIdsToRemove,
        ),
    );
    await this.filesService.cleanup(filesToRemove);
    const actorDepartmentIds =
      await this.ticketAccess.getActorDepartmentIds(actor);
    this.ticketRealtimePublisher.publishMutation(
      mutation.ticket,
      mutation.ticketEventId,
      actor.userId,
      TicketEventAction.MODIFICATION,
    );
    if (oldPriority !== mutation.ticket.priority) {
      this.ticketNotifications.notifySubmitter(
        mutation.ticket,
        actor.userId,
        'TICKET_UPDATED',
        `The priority of ticket ${mutation.ticket.ticketCode} was updated.`,
      );
    }
    return this.ticketResponseMapper.withPermission(
      mutation.ticket,
      actor,
      actorDepartmentIds,
    );
  }

  async cancel(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions> {
    const ticket = await this.ticketAccess.getActiveTicket(ticketId);
    this.cancelTicketPolicy.assert(ticket, actor);

    ticket.active = false;
    ticket.unclaimedSince = null;
    ticket.lastReminderAt = null;
    const now = new Date();
    ticket.updatedAt = now;
    const mutation = await this.ticketLifecycleRepository.saveWithEvent(
      ticket,
      {
        ticketId,
        userId: actor.userId,
        action: TicketEventAction.DELETE,
        details: { deletedById: actor.userId },
        createdAt: now,
      },
    );
    this.ticketRealtimePublisher.publishMutation(
      mutation.ticket,
      mutation.ticketEventId,
      actor.userId,
      TicketEventAction.DELETE,
    );
    return this.mapMutation(mutation.ticket, actor);
  }

  private async mapMutation(
    ticket: TicketRecord,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions> {
    const actorDepartmentIds =
      await this.ticketAccess.getActorDepartmentIds(actor);
    return this.ticketResponseMapper.withPermission(
      ticket,
      actor,
      actorDepartmentIds,
    );
  }

  private parseRemovedAttachmentIds(value?: string): string[] {
    if (!value) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new BadRequestException(
        'Removed attachment IDs must be a JSON array',
      );
    }
    if (!Array.isArray(parsed)) {
      throw new BadRequestException(
        'Removed attachment IDs must be a JSON array',
      );
    }

    const attachmentIds = parsed as unknown[];
    if (
      attachmentIds.some(
        (attachmentId) => typeof attachmentId !== 'string' || !attachmentId,
      )
    ) {
      throw new BadRequestException(
        'Removed attachment IDs must be a JSON array',
      );
    }

    const uniqueAttachmentIds = [...new Set(attachmentIds as string[])];
    if (uniqueAttachmentIds.length > 20) {
      throw new BadRequestException(
        'No more than 20 attachments can be removed at once',
      );
    }
    return uniqueAttachmentIds;
  }

  private async withStoredFiles<T>(
    files: UploadedFileInput[] | undefined,
    uploadedBy: string,
    operation: (storedFiles: StoredFileMetadata[]) => Promise<T>,
  ): Promise<T> {
    const storedFiles = await this.filesService.storeForUser(files, uploadedBy);
    try {
      return await operation(storedFiles);
    } catch (error) {
      await this.filesService.cleanup(storedFiles);
      throw error;
    }
  }
}
