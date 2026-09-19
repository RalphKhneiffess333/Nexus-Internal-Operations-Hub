import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { PrismaService } from '../database/prisma.service';
import { DepartmentsRepository } from '../departments/repositories/departments.repository';
import {
  FileAttachmentsRepository,
  type StoredFileMetadata,
} from '../files/file-attachments.repository';
import { FilesService } from '../files/files.service';
import type { UploadedFileInput } from '../files/file-validation';
import {
  RealtimeInternalEvent,
  type ChatMessageCreatedRealtimeEvent,
} from '../realtime/realtime-events';
import { TicketsRepository } from '../tickets/repositories/tickets.repository';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import { ChatPolicy } from './policies/chat.policy';
import {
  ChatRepository,
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

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsRepository: TicketsRepository,
    private readonly departmentsRepository: DepartmentsRepository,
    private readonly chatRepository: ChatRepository,
    private readonly chatPolicy: ChatPolicy,
    private readonly filesService: FilesService,
    private readonly fileAttachmentsRepository: FileAttachmentsRepository,
    private readonly eventEmitter: EventEmitter2,
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
      const message = await this.prisma.$transaction(async (tx) => {
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
        for (const file of storedFiles) {
          await this.fileAttachmentsRepository.createForMessage(
            created.messageId,
            file,
            tx,
          );
        }
        return tx.chatMessage.findUniqueOrThrow({
          where: { messageId: created.messageId },
          include: {
            sender: { select: { userId: true, fullName: true, email: true, role: true } },
            attachments: {
              include: {
                file: {
                  select: {
                    fileId: true,
                    originalName: true,
                    fileSize: true,
                    mimeType: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        });
      });
      const response = this.toResponse(message);
      this.publishMessage(response, actor.userId);
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

  private async getActorDepartmentIds(
    userId: string,
    client?: Prisma.TransactionClient,
  ): Promise<string[]> {
    if (!client) {
      return this.departmentsRepository.findActiveDepartmentIdsByUserId(userId);
    }
    const memberships = await client.departmentMember.findMany({
      where: { userId, department: { active: true } },
      select: { departmentId: true },
    });
    return memberships.map((membership) => membership.departmentId);
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
}
