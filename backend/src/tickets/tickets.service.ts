import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Ticket,
  TicketEventAction,
  TicketStatus,
  UserRole,
} from '@prisma/client';
import { StreamableFile } from '@nestjs/common';
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
import { TicketQueryDto } from './dto/ticket-query.dto';
import type { TicketEventRecord } from './events/ticket-event.types';
import { TicketEventsRepository } from './events/ticket-events.repository';
import { CancelTicketPolicy } from './policies/cancel-ticket.policy';
import { ClaimTicketPolicy } from './policies/claim-ticket.policy';
import { CloseTicketPolicy } from './policies/close-ticket.policy';
import { ModifyTicketPolicy } from './policies/modify-ticket.policy';
import { ReopenTicketPolicy } from './policies/reopen-ticket.policy';
import { SubmitTicketPolicy } from './policies/submit-ticket.policy';
import { ViewTicketPolicy } from './policies/view-ticket.policy';
import {
  TicketRecord,
  TicketsRepository,
} from './repositories/tickets.repository';
import { TicketLifecycleRepository } from './repositories/ticket-lifecycle.repository';
import { TicketRealtimePublisher } from './realtime/ticket-realtime.publisher';
import { EmailNotificationsService } from '../notifications/email-notifications.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface TicketActionPermissions {
  canModify: boolean;
  canCancel: boolean;
  canClaim: boolean;
  canClose: boolean;
  canRequestHandoff: boolean;
  canReopen: boolean;
}

export interface TicketUserProfile {
  userId: string;
  fullName: string;
  email: string;
}

export type TicketWithPermissions = Omit<
  TicketRecord,
  'submittedBy' | 'agentId' | 'submitter' | 'agent'
> & {
  submittedBy: TicketUserProfile;
  agent: TicketUserProfile | null;
  permissions: TicketActionPermissions;
};

@Injectable()
export class TicketsService {
  constructor(
    private readonly ticketsRepository: TicketsRepository,
    private readonly ticketEventsRepository: TicketEventsRepository,
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
    private readonly viewTicketPolicy: ViewTicketPolicy,
    private readonly ticketRealtimePublisher: TicketRealtimePublisher,
    private readonly notifications: NotificationsService,
    private readonly emailNotifications?: EmailNotificationsService,
  ) {}

  async findAll(
    actor: AuthenticatedRequestUser,
    filters: TicketQueryDto = {},
  ): Promise<TicketWithPermissions[]> {
    const tickets = await this.ticketsRepository.findAll(filters);
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    return this.withPermissions(
      tickets.filter(
        (ticket) =>
          ticket.active &&
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
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    return this.withPermissions(tickets, actor, actorDepartmentIds);
  }

  async findClaimed(
    actor: AuthenticatedRequestUser,
    filters: TicketQueryDto = {},
  ): Promise<TicketWithPermissions[]> {
    const tickets = await this.ticketsRepository.findActiveByAgent(
      actor.userId,
      filters,
    );
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    return this.withPermissions(tickets, actor, actorDepartmentIds);
  }

  async findResolved(
    actor: AuthenticatedRequestUser,
    filters: TicketQueryDto = {},
  ): Promise<TicketWithPermissions[]> {
    const tickets = await this.ticketsRepository.findActiveResolvedByAgent(
      actor.userId,
      filters,
    );
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    return this.withPermissions(tickets, actor, actorDepartmentIds);
  }

  async findDepartmentTickets(
    actor: AuthenticatedRequestUser,
    filters: TicketQueryDto = {},
  ): Promise<TicketWithPermissions[]> {
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    const tickets = await this.ticketsRepository.findActiveByDepartmentIds(
      actorDepartmentIds,
      filters,
    );
    return this.withPermissions(tickets, actor, actorDepartmentIds);
  }

  async findPool(
    actor: AuthenticatedRequestUser,
    filters: TicketQueryDto = {},
  ): Promise<TicketWithPermissions[]> {
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    const tickets = await this.ticketsRepository.findTicketPool(
      actorDepartmentIds,
      filters,
    );
    return this.withPermissions(tickets, actor, actorDepartmentIds);
  }

  async findOne(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions> {
    const ticket = await this.getActiveTicket(ticketId);
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    this.viewTicketPolicy.assert(actor, ticket, actorDepartmentIds);
    return this.withPermission(ticket, actor, actorDepartmentIds);
  }

  async findEvents(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketEventRecord[]> {
    await this.assertCanViewTicket(ticketId, actor);
    return this.ticketEventsRepository.findByTicketId(ticketId);
  }

  async findEvent(
    ticketId: string,
    ticketEventId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketEventRecord> {
    await this.assertCanViewTicket(ticketId, actor);
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
    await this.notifyTicketLifecycle(
      mutation.ticket,
      TicketEventAction.SUBMISSION,
      actor.userId,
    );
    void this.emailNotifications?.notifyTicketSubmitted(
      mutation.ticket.ticketId,
      actor.userId,
    );
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    return this.withPermission(mutation.ticket, actor, actorDepartmentIds);
  }

  async claim(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions> {
    const ticket = await this.getActiveTicket(ticketId);
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
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
    this.notifySubmitter(
      claimed.ticket,
      actor.userId,
      'TICKET_CLAIMED',
      `Your ticket ${claimed.ticket.ticketCode} has been claimed.`,
    );
    void this.emailNotifications?.notifyTicketClaimed(
      claimed.ticket.ticketId,
      actor.userId,
    );
    return this.withPermission(claimed.ticket, actor, actorDepartmentIds);
  }

  async close(
    ticketId: string,
    dto: CloseTicketDto,
    actor: AuthenticatedRequestUser,
    files?: UploadedFileInput[],
  ): Promise<TicketWithPermissions> {
    const ticket = await this.getActiveTicket(ticketId);
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
    this.notifySubmitter(
      mutation.ticket,
      actor.userId,
      'TICKET_CLOSED',
      `Your ticket ${mutation.ticket.ticketCode} has been closed.`,
    );
    void this.emailNotifications?.notifyTicketClosed(
      mutation.ticket.ticketId,
      actor.userId,
    );
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    return this.withPermission(mutation.ticket, actor, actorDepartmentIds);
  }

  async reopen(
    ticketId: string,
    dto: ReopenTicketDto,
    actor: AuthenticatedRequestUser,
    files?: UploadedFileInput[],
  ): Promise<TicketWithPermissions> {
    const ticket = await this.getActiveTicket(ticketId);
    this.reopenTicketPolicy.assert(ticket, actor);

    const mutation = await this.withStoredFiles(
      files,
      actor.userId,
      async (storedFiles) => {
        ticket.status = TicketStatus.REOPENED;
        ticket.agentId = null;
        ticket.closedAt = null;
        if (dto.description) {
          ticket.description = dto.description;
        }
        const now = new Date();
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
    await this.notifyTicketLifecycle(
      mutation.ticket,
      TicketEventAction.REOPEN,
      actor.userId,
    );
    void this.emailNotifications?.notifyTicketReopened(
      mutation.ticket.ticketId,
      actor.userId,
    );
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    return this.withPermission(mutation.ticket, actor, actorDepartmentIds);
  }

  async modify(
    ticketId: string,
    dto: ModifyTicketDto,
    actor: AuthenticatedRequestUser,
    files?: UploadedFileInput[],
  ): Promise<TicketWithPermissions> {
    const ticket = await this.getActiveTicket(ticketId);
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

    if (dto.departmentId !== undefined) {
      ticket.departmentId = dto.departmentId;
    }
    if (dto.title !== undefined) {
      ticket.title = dto.title;
    }
    if (dto.description !== undefined) {
      ticket.description = dto.description;
    }
    if (dto.priority !== undefined) {
      ticket.priority = dto.priority;
    }
    const changed =
      oldTitle !== ticket.title ||
      oldDescription !== ticket.description ||
      oldPriority !== ticket.priority ||
      oldDepartmentId !== ticket.departmentId;
    const attachmentChanges =
      filesToRemove.length > 0 || (files?.length ?? 0) > 0;
    if (!changed && !attachmentChanges) {
      const actorDepartmentIds = await this.getActorDepartmentIds(actor);
      return this.withPermission(ticket, actor, actorDepartmentIds);
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
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    this.ticketRealtimePublisher.publishMutation(
      mutation.ticket,
      mutation.ticketEventId,
      actor.userId,
      TicketEventAction.MODIFICATION,
    );
    if (oldPriority !== mutation.ticket.priority) {
      this.notifySubmitter(
        mutation.ticket,
        actor.userId,
        'TICKET_UPDATED',
        `The priority of ticket ${mutation.ticket.ticketCode} was updated.`,
      );
    }
    return this.withPermission(mutation.ticket, actor, actorDepartmentIds);
  }

  async cancel(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketWithPermissions> {
    const ticket = await this.getActiveTicket(ticketId);
    this.cancelTicketPolicy.assert(ticket, actor);

    ticket.active = false;
    const now = new Date();
    ticket.updatedAt = now;
    const mutation = await this.ticketLifecycleRepository.saveWithEvent(
      ticket,
      {
        ticketId,
        userId: actor.userId,
        action: TicketEventAction.DELETE,
        details: {
          deletedById: actor.userId,
        },
        createdAt: now,
      },
    );
    this.ticketRealtimePublisher.publishMutation(
      mutation.ticket,
      mutation.ticketEventId,
      actor.userId,
      TicketEventAction.DELETE,
    );
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    return this.withPermission(mutation.ticket, actor, actorDepartmentIds);
  }

  private async getActorDepartmentIds(
    actor: AuthenticatedRequestUser,
  ): Promise<string[]> {
    return this.departmentsRepository.findActiveDepartmentIdsByUserId(
      actor.userId,
    );
  }

  private async notifyTicketLifecycle(
    ticket: TicketRecord,
    action: 'SUBMISSION' | 'REOPEN',
    actorId: string,
  ): Promise<void> {
    const department = await this.departmentsRepository.findById(
      ticket.departmentId,
    );
    const reopened = action === TicketEventAction.REOPEN;
    await this.notifications.notifyDepartmentAgents(
      ticket.departmentId,
      {
        type: reopened ? 'TICKET_REOPENED' : 'TICKET_OPENED',
        message: `New ticket ${reopened ? 'reopened' : 'opened'} in ${department?.name ?? 'your department'}.`,
        ticketId: ticket.ticketId,
        link: `/tickets/${ticket.ticketId}`,
      },
      actorId,
    );
  }

  private notifySubmitter(
    ticket: TicketRecord,
    actorId: string,
    type: 'TICKET_CLAIMED' | 'TICKET_CLOSED' | 'TICKET_UPDATED',
    message: string,
  ): void {
    if (ticket.submittedBy === actorId) return;
    this.notifications.notify({
      type,
      message,
      recipientUserIds: [ticket.submittedBy],
      ticketId: ticket.ticketId,
      link: `/tickets/${ticket.ticketId}`,
    });
  }

  private parseRemovedAttachmentIds(value?: string): string[] {
    if (!value) {
      return [];
    }

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

    return [...new Set(attachmentIds as string[])];
  }

  async downloadAttachment(
    ticketId: string,
    eventId: string,
    attachmentId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<StreamableFile> {
    await this.assertCanViewTicket(ticketId, actor);
    const attachment = await this.fileAttachmentsRepository.findForTicketEvent(
      ticketId,
      eventId,
      attachmentId,
    );
    if (!attachment) {
      throw new NotFoundException('Attachment was not found');
    }

    let contents: Buffer;
    try {
      contents = await this.filesService.read(attachment.storageKey);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('Attachment file was not found');
      }
      throw error;
    }
    return new StreamableFile(contents, {
      type: attachment.mimeType,
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
    });
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

  private async getActiveTicket(ticketId: string): Promise<TicketRecord> {
    const ticket = await this.ticketsRepository.findById(ticketId);
    if (!ticket || !ticket.active) {
      throw new NotFoundException(`Ticket ${ticketId} was not found`);
    }
    return ticket;
  }

  private async assertCanViewTicket(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<void> {
    const ticket = await this.getActiveTicket(ticketId);
    const actorDepartmentIds = await this.getActorDepartmentIds(actor);
    this.viewTicketPolicy.assert(actor, ticket, actorDepartmentIds);
  }

  private withPermissions(
    tickets: TicketRecord[],
    actor: AuthenticatedRequestUser,
    actorDepartmentIds: string[],
  ): TicketWithPermissions[] {
    return tickets.map((ticket) =>
      this.withPermission(ticket, actor, actorDepartmentIds),
    );
  }

  private withPermission(
    ticket: TicketRecord,
    actor: AuthenticatedRequestUser,
    actorDepartmentIds: string[],
  ): TicketWithPermissions {
    const { submittedBy, agentId, submitter, agent, ...ticketFields } = ticket;

    return {
      ...ticketFields,
      submittedBy: {
        userId: submittedBy,
        fullName: submitter.fullName,
        email: submitter.email,
      },
      agent:
        agent && agentId
          ? {
              userId: agentId,
              fullName: agent.fullName,
              email: agent.email,
            }
          : null,
      permissions: {
        canModify: this.canModify(ticket, actor),
        canCancel: this.canCancel(ticket, actor),
        canClaim: this.canClaim(ticket, actor, actorDepartmentIds),
        canClose: this.canClose(ticket, actor),
        canRequestHandoff: this.canRequestHandoff(
          ticket,
          actor,
          actorDepartmentIds,
        ),
        canReopen: this.canReopen(ticket, actor),
      },
    };
  }

  private canModify(ticket: Ticket, actor: AuthenticatedRequestUser): boolean {
    return (
      ticket.active &&
      ticket.status === TicketStatus.OPEN &&
      ticket.agentId === null &&
      ticket.submittedBy === actor.userId
    );
  }

  private canCancel(ticket: Ticket, actor: AuthenticatedRequestUser): boolean {
    return this.canModify(ticket, actor);
  }

  private canClaim(
    ticket: Ticket,
    actor: AuthenticatedRequestUser,
    actorDepartmentIds: string[],
  ): boolean {
    const canWorkTickets =
      (actor.role === UserRole.Admin || actor.role === UserRole.Agent) &&
      actorDepartmentIds.includes(ticket.departmentId);

    return (
      canWorkTickets &&
      ticket.active &&
      (ticket.status === TicketStatus.OPEN ||
        ticket.status === TicketStatus.REOPENED) &&
      ticket.agentId === null
    );
  }

  private canClose(ticket: Ticket, actor: AuthenticatedRequestUser): boolean {
    return (
      actor.isActive &&
      (actor.role === UserRole.Agent || actor.role === UserRole.Admin) &&
      ticket.active &&
      ticket.status === TicketStatus.CLAIMED &&
      (ticket.agentId === actor.userId || actor.role === UserRole.Admin)
    );
  }

  private canRequestHandoff(
    ticket: Ticket,
    actor: AuthenticatedRequestUser,
    actorDepartmentIds: string[],
  ): boolean {
    return (
      actor.isActive &&
      (actor.role === UserRole.Agent || actor.role === UserRole.Admin) &&
      ticket.active &&
      ticket.status === TicketStatus.CLAIMED &&
      ticket.agentId === actor.userId &&
      actorDepartmentIds.includes(ticket.departmentId)
    );
  }

  private canReopen(ticket: Ticket, actor: AuthenticatedRequestUser): boolean {
    return (
      ticket.active &&
      ticket.status === TicketStatus.CLOSED &&
      ticket.agentId === null &&
      ticket.submittedBy === actor.userId
    );
  }
}
