import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Prisma } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { DepartmentsRepository } from '../departments/repositories/departments.repository';
import {
  FileAttachmentsRepository,
} from '../files/file-attachments.repository';
import { FilesService } from '../files/files.service';
import type { UploadedFileInput } from '../files/file-validation';
import {
  RealtimeInternalEvent,
  type ChatMessageCreatedRealtimeEvent,
} from '../realtime/realtime-events';
import { TicketsRepository } from '../tickets/repositories/tickets.repository';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatPolicy } from './policies/chat.policy';
import {
  ChatRepository,
  type ChatInboxTicketRecord,
  type ChatMessageRecord,
} from './repositories/chat.repository';

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

export interface ChatConversationResponse {
  ticketId: string;
  ticketCode: string;
  title: string;
  status: string;
  lastMessage: {
    messageId: string;
    content: string | null;
    createdAt: Date;
    sender: ChatMessageResponse['sender'];
    hasAttachments: boolean;
  } | null;
  unread: boolean;
}

@Injectable()
export class ChatService {
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
  ): Promise<ChatMessageResponse[]> {
    const ticket = await this.ticketsRepository.findById(ticketId);
    if (!ticket || !ticket.active) throw new NotFoundException('Ticket was not found');
    const departmentIds = await this.getActorDepartmentIds(actor.userId);
    this.chatPolicy.assertCanView(actor, ticket, departmentIds);
    const messages = await this.chatRepository.findByTicketId(ticketId);
    return messages.map((message) => this.toResponse(message));
  }

  async listConversations(
    actor: AuthenticatedRequestUser,
  ): Promise<ChatConversationResponse[]> {
    const actorDepartmentIds = await this.getActorDepartmentIds(actor.userId);
    const tickets = await this.chatRepository.findInboxTickets(actor.userId);
    return tickets
      .filter((ticket) =>
        this.viewableByActor(ticket, actor, actorDepartmentIds),
      )
      .map((ticket) => this.toConversationResponse(ticket, actor.userId))
      .sort((left, right) => {
        const rightTime = right.lastMessage?.createdAt.getTime() ?? 0;
        const leftTime = left.lastMessage?.createdAt.getTime() ?? 0;
        return rightTime - leftTime || right.ticketCode.localeCompare(left.ticketCode);
      });
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
    const content = dto.content?.trim() || null;
    const storedFiles = await this.filesService.storeForUser(files, actor.userId);
    if (!content && storedFiles.length === 0) {
      await this.filesService.cleanup(storedFiles);
      throw new BadRequestException(
        'A chat message must include text or an attachment',
      );
    }

    try {
      const message = await this.chatRepository.transaction(async (tx) => {
        const ticket = await this.ticketsRepository.findByIdForUpdate(ticketId, tx);
        if (!ticket || !ticket.active) throw new NotFoundException('Ticket was not found');
        const departmentIds = await this.getActorDepartmentIds(actor.userId, tx);
        this.chatPolicy.assertCanSend(actor, ticket, departmentIds);
        const created = await this.chatRepository.create(
          ticketId,
          actor.userId,
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
        if (!persisted) throw new NotFoundException('Chat message was not found');
        return persisted;
      });
      const response = this.toResponse(message);
      this.publishMessage(response, actor.userId);
      const ticket = await this.ticketsRepository.findById(ticketId);
      const recipientUserId =
        ticket?.submittedBy === actor.userId ? ticket.agentId : ticket?.submittedBy;
      if (recipientUserId) {
        this.notifications.notify({
          type: 'CHAT_MESSAGE',
          message: `New message received on ticket ${ticket?.ticketCode ?? ''}.`,
          recipientUserIds: [recipientUserId],
          ticketId,
          link: `/chats/${ticketId}`,
        });
      }
      return response;
    } catch (error) {
      await this.filesService.cleanup(storedFiles);
      throw error;
    }
  }

  async assertCanViewChat(
    ticketId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<void> {
    const ticket = await this.ticketsRepository.findById(ticketId);
    if (!ticket || !ticket.active) throw new NotFoundException('Ticket was not found');
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

  private async getActorDepartmentIds(userId: string, client?: Prisma.TransactionClient): Promise<string[]> {
    if (!client) return this.departmentsRepository.findActiveDepartmentIdsByUserId(userId);
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

  private viewableByActor(
    ticket: ChatInboxTicketRecord,
    actor: AuthenticatedRequestUser,
    actorDepartmentIds: string[],
  ): boolean {
    try {
      this.chatPolicy.assertCanView(actor, ticket, actorDepartmentIds);
      return true;
    } catch {
      return false;
    }
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
      unread:
        Boolean(lastMessage) &&
        lastMessage!.senderId !== actorId &&
        (!lastReadAt || lastMessage!.createdAt > lastReadAt),
    };
  }
}
