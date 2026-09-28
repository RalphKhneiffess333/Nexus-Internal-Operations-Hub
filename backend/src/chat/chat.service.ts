import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Prisma } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { DepartmentsRepository } from '../departments/repositories/departments.repository';
import { FileAttachmentsRepository } from '../files/file-attachments.repository';
import { FilesService } from '../files/files.service';
import type { UploadedFileInput } from '../files/file-validation';
import {
  RealtimeInternalEvent,
  type ChatMessageCreatedRealtimeEvent,
} from '../realtime/realtime-events';
import { TicketsRepository } from '../tickets/repositories/tickets.repository';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import { ChatInboxQueryDto, ChatMessagesQueryDto } from './dto/chat-query.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatPolicy } from './policies/chat.policy';
import { sanitizePlainText } from '../common/sanitization/content-sanitizer';
import {
  ChatRepository,
  ChatMessageClientIdConflictError,
  type ChatInboxPage,
  type ChatInboxTicketRecord,
  type ChatMessageListPage,
  type ChatMessageRecord,
  type ChatMessageListRecord,
} from './repositories/chat.repository';
import { logSystemError } from '../common/logging/system-error.logger';

export interface ChatAttachmentResponse {
  attachmentId: string;
  fileId: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessageResponse {
  messageId: string;
  clientMessageId: string | null;
  ticketId: string;
  content: string | null;
  createdAt: Date;
  updatedAt: Date;
  sender: {
    userId: string;
    fullName: string;
    email: string;
    role: string;
  };
  attachments: ChatAttachmentResponse[];
}

export interface ChatMessageListResponse {
  messageId: string;
  clientMessageId: string | null;
  ticketId: string;
  content: string | null;
  createdAt: Date;
  updatedAt: Date;
  sender: {
    userId: string;
    fullName: string;
  };
  attachments: Array<{
    attachmentId: string;
    originalName: string;
  }>;
}

export interface ChatConversationResponse {
  ticketId: string;
  ticketCode: string;
  title: string;
  status: string;
  lastMessage: {
    messageId: string;
    content: string | null;
    createdAt: Date;
    sender: {
      userId: string;
      fullName: string;
    };
    hasAttachments: boolean;
  } | null;
  unread: boolean;
}

export interface ChatMessageListPageResponse {
  items: ChatMessageListResponse[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ChatConversationPageResponse {
  items: ChatConversationResponse[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly ticketsRepository: TicketsRepository,
    private readonly departmentsRepository: DepartmentsRepository,
    private readonly chatRepository: ChatRepository,
    private readonly chatPolicy: ChatPolicy,
    private readonly filesService: FilesService,
    private readonly fileAttachmentsRepository: FileAttachmentsRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly notifications: NotificationsService,
  ) {}

  async listMessages(
    ticketId: string,
    actor: AuthenticatedRequestUser,
    query: ChatMessagesQueryDto = {},
  ): Promise<ChatMessageListResponse[]> {
    const result = await this.listMessagesPage(ticketId, actor, query);
    return result.items;
  }

  async listMessagesPage(
    ticketId: string,
    actor: AuthenticatedRequestUser,
    query: ChatMessagesQueryDto = {},
  ): Promise<ChatMessageListPageResponse> {
    const ticket = await this.ticketsRepository.findById(ticketId);
    if (!ticket || !ticket.active)
      throw new NotFoundException('Ticket was not found');
    const departmentIds = await this.getActorDepartmentIds(actor.userId);
    this.chatPolicy.assertCanView(actor, ticket, departmentIds);
    const result: ChatMessageListPage =
      await this.chatRepository.findByTicketId(
        ticketId,
        query.page,
        query.pageSize,
      );
    return {
      ...result,
      items: result.items.map((message) => this.toListResponse(message)),
    };
  }

  async listConversations(
    actor: AuthenticatedRequestUser,
    query: ChatInboxQueryDto = {},
  ): Promise<ChatConversationResponse[]> {
    const result = await this.listConversationsPage(actor, query);
    return result.items;
  }

  async listConversationsPage(
    actor: AuthenticatedRequestUser,
    query: ChatInboxQueryDto = {},
  ): Promise<ChatConversationPageResponse> {
    const result: ChatInboxPage = await this.chatRepository.findInboxTickets(
      actor.userId,
      query.page,
      query.pageSize,
      query.search,
    );
    return {
      ...result,
      items: result.items.map((ticket) =>
        this.toConversationResponse(ticket, actor.userId),
      ),
    };
  }

  async markConversationRead(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<void> {
    await this.assertCanViewChat(ticketId, actor);
    await this.chatRepository.markRead(ticketId, actor.userId, new Date());
  }

  async createMessage(
    ticketId: string,
    dto: CreateChatMessageDto,
    actor: AuthenticatedRequestUser,
    files?: UploadedFileInput[],
  ): Promise<ChatMessageResponse> {
    const content = dto.content ? sanitizePlainText(dto.content) || null : null;
    const clientMessageId = dto.clientMessageId ?? randomUUID();
    if (!content && (files?.length ?? 0) === 0) {
      throw new BadRequestException(
        'A chat message must include text or an attachment',
      );
    }
    const storedFiles = await this.filesService.storeForUser(
      files,
      actor.userId,
    );
    if (!content && storedFiles.length === 0) {
      await this.filesService.cleanup(storedFiles);
      throw new BadRequestException(
        'A chat message must include text or an attachment',
      );
    }

    let result: { message: ChatMessageRecord; created: boolean };
    let notificationTicket:
      | {
          departmentId: string;
          submittedBy: string;
          agentId: string | null;
          ticketCode: string;
        }
      | undefined;
    try {
      result = await this.chatRepository.transaction(async (tx) => {
        const ticket = await this.ticketsRepository.findByIdForUpdate(
          ticketId,
          tx,
        );
        if (!ticket || !ticket.active)
          throw new NotFoundException('Ticket was not found');
        const departmentIds = await this.getActorDepartmentIds(
          actor.userId,
          tx,
        );
        this.chatPolicy.assertCanSend(actor, ticket, departmentIds);
        const existing = await this.chatRepository.findMessageByClientMessageId(
          ticketId,
          actor.userId,
          clientMessageId,
          tx,
        );
        if (existing) return { message: existing, created: false };
        const created = await this.chatRepository.create(
          ticketId,
          actor.userId,
          clientMessageId,
          content,
          new Date(),
          tx,
        );
        await this.chatRepository.markRead(
          ticketId,
          actor.userId,
          created.createdAt,
          tx,
        );
        for (const file of storedFiles) {
          await this.fileAttachmentsRepository.createForMessage(
            created.messageId,
            file,
            tx,
          );
        }
        const persisted = await this.chatRepository.findMessageById(
          created.messageId,
          tx,
        );
        if (!persisted)
          throw new NotFoundException('Chat message was not found');
        notificationTicket = {
          departmentId: ticket.departmentId,
          submittedBy: ticket.submittedBy,
          agentId: ticket.agentId,
          ticketCode: ticket.ticketCode,
        };
        return { message: persisted, created: true };
      });
    } catch (error) {
      if (error instanceof ChatMessageClientIdConflictError) {
        const existing = await this.chatRepository.findMessageByClientMessageId(
          ticketId,
          actor.userId,
          clientMessageId,
        );
        if (existing) {
          await this.filesService.cleanup(storedFiles);
          return this.toResponse(existing);
        }
      }
      await this.filesService.cleanup(storedFiles);
      throw error;
    }

    const response = this.toResponse(result.message);
    if (!result.created) {
      await this.filesService.cleanup(storedFiles);
      return response;
    }

    // Broadcast the canonical message as soon as its transaction commits.
    this.publishMessage(response, actor.userId);
    if (notificationTicket) {
      this.notifyChatViewers(notificationTicket, ticketId, actor.userId);
    }
    return response;
  }

  async assertCanViewChat(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<void> {
    const ticket = await this.ticketsRepository.findById(ticketId);
    if (!ticket || !ticket.active)
      throw new NotFoundException('Ticket was not found');
    this.chatPolicy.assertCanView(
      actor,
      ticket,
      await this.getActorDepartmentIds(actor.userId),
    );
  }

  async downloadAttachment(
    ticketId: string,
    messageId: string,
    attachmentId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<StreamableFile> {
    await this.assertCanViewChat(ticketId, actor);
    const attachment = await this.fileAttachmentsRepository.findForChatMessage(
      ticketId,
      messageId,
      attachmentId,
    );
    if (!attachment) throw new NotFoundException('Attachment was not found');
    const contents = await this.filesService.read(attachment.storageKey);
    return new StreamableFile(contents, {
      type: attachment.mimeType,
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
    });
  }

  private async getActorDepartmentIds(
    userId: string,
    client?: Prisma.TransactionClient,
  ): Promise<string[]> {
    if (!client)
      return this.departmentsRepository.findActiveDepartmentIdsByUserId(userId);
    return this.chatRepository.findActiveDepartmentIdsByUserId(userId, client);
  }

  private publishMessage(message: ChatMessageResponse, actorId: string): void {
    const event: ChatMessageCreatedRealtimeEvent = {
      eventId: message.messageId,
      occurredAt: message.createdAt.toISOString(),
      version: 1,
      ticketId: message.ticketId,
      actorId,
      payload: message,
    };
    this.eventEmitter.emit(RealtimeInternalEvent.ChatMessageCreated, event);
  }

  private toResponse(message: ChatMessageRecord): ChatMessageResponse {
    return {
      messageId: message.messageId,
      clientMessageId: message.clientMessageId,
      ticketId: message.ticketId,
      content: message.content,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      sender: message.sender,
      attachments: message.attachments.map((attachment) => ({
        attachmentId: attachment.attachmentId,
        fileId: attachment.file.fileId,
        originalName: attachment.file.originalName,
        fileSize: attachment.file.fileSize,
        mimeType: attachment.file.mimeType,
        createdAt: attachment.file.createdAt,
        updatedAt: attachment.file.updatedAt,
      })),
    };
  }

  private toListResponse(
    message: ChatMessageListRecord,
  ): ChatMessageListResponse {
    return {
      messageId: message.messageId,
      clientMessageId: message.clientMessageId,
      ticketId: message.ticketId,
      content: message.content,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      sender: message.sender,
      attachments: message.attachments.map((attachment) => ({
        attachmentId: attachment.attachmentId,
        originalName: attachment.file.originalName,
      })),
    };
  }

  private toConversationResponse(
    ticket: ChatInboxTicketRecord,
    actorId: string,
  ): ChatConversationResponse {
    const lastMessage = ticket.chatMessages[0] ?? null;
    const lastReadAt = ticket.chatReadReceipts[0]?.lastReadAt;
    return {
      ticketId: ticket.ticketId,
      ticketCode: ticket.ticketCode,
      title: ticket.title,
      status: ticket.status,
      lastMessage: lastMessage
        ? {
            messageId: lastMessage.messageId,
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            sender: lastMessage.sender,
            hasAttachments: lastMessage.attachments.length > 0,
          }
        : null,
      unread: Boolean(
        lastMessage &&
        lastMessage.senderId !== actorId &&
        (!lastReadAt || lastMessage.createdAt > lastReadAt),
      ),
    };
  }

  private notifyChatViewers(
    ticket: {
      departmentId: string;
      submittedBy: string;
      agentId: string | null;
      ticketCode: string;
    },
    ticketId: string,
    actorId: string,
  ): void {
    void this.notifications
      .notifyChatViewers(
        ticket.departmentId,
        ticket.submittedBy,
        ticket.agentId,
        {
          type: 'CHAT_MESSAGE',
          message: `New message received on ticket ${ticket.ticketCode}.`,
          actorId,
          ticketId,
          link: `/chats/${ticketId}`,
        },
        actorId,
      )
      .catch((error: unknown) => {
        // Notification delivery must not fail a persisted chat message.
        logSystemError(this.logger, error, {
          operation: 'chat.notify-viewers',
          object: { type: 'ticket', id: ticketId },
        });
      });
  }
}
