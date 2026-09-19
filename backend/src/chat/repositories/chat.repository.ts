import { randomUUID } from 'node:crypto';
import { HttpException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mapPrismaError } from '../../database/prisma-error';
import { PrismaService } from '../../database/prisma.service';

const senderSelect = {
  userId: true,
  fullName: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;

const messageInclude = {
  sender: { select: senderSelect },
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
} satisfies Prisma.ChatMessageInclude;

const inboxTicketInclude = {
  chatMessages: {
    take: 1,
    orderBy: [{ createdAt: 'desc' }, { messageId: 'desc' }],
    include: {
      sender: { select: senderSelect },
      attachments: { select: { attachmentId: true } },
    },
  },
  chatReadReceipts: {
    take: 1,
    select: { lastReadAt: true },
  },
} satisfies Prisma.TicketInclude;

export type ChatMessageRecord = Prisma.ChatMessageGetPayload<{
  include: typeof messageInclude;
}>;

export type ChatInboxTicketRecord = Prisma.TicketGetPayload<{
  include: typeof inboxTicketInclude;
}>;

export type ChatPersistenceClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class ChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  async transaction<T>(
    operation: (client: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(operation);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      mapPrismaError(error);
    }
  }

  async findByTicketId(ticketId: string): Promise<ChatMessageRecord[]> {
    try {
      return await this.prisma.chatMessage.findMany({
        where: { ticketId },
        orderBy: [{ createdAt: 'asc' }, { messageId: 'asc' }],
        include: messageInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async create(
    ticketId: string,
    senderId: string,
    content: string | null,
    createdAt: Date,
    client: Prisma.TransactionClient,
  ): Promise<ChatMessageRecord> {
    try {
      return await client.chatMessage.create({
        data: {
          messageId: randomUUID(),
          ticketId,
          senderId,
          content,
          createdAt,
          updatedAt: createdAt,
        },
        include: messageInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findMessageById(
    messageId: string,
    client: ChatPersistenceClient = this.prisma,
  ): Promise<ChatMessageRecord | null> {
    try {
      return await client.chatMessage.findUnique({
        where: { messageId },
        include: messageInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findActiveDepartmentIdsByUserId(
    userId: string,
    client: ChatPersistenceClient = this.prisma,
  ): Promise<string[]> {
    try {
      const memberships = await client.departmentMember.findMany({
        where: { userId, department: { active: true } },
        select: { departmentId: true },
      });
      return memberships.map((membership) => membership.departmentId);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findInboxTickets(userId: string): Promise<ChatInboxTicketRecord[]> {
    try {
      return await this.prisma.ticket.findMany({
        where: { active: true },
        include: {
          ...inboxTicketInclude,
          chatReadReceipts: {
            where: { userId },
            take: 1,
            select: { lastReadAt: true },
          },
        },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async markRead(
    ticketId: string,
    userId: string,
    lastReadAt: Date,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    try {
      await client.chatReadReceipt.upsert({
        where: { ticketId_userId: { ticketId, userId } },
        create: { ticketId, userId, lastReadAt },
        update: { lastReadAt },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }
}
