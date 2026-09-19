import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
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

export type ChatMessageRecord = Prisma.ChatMessageGetPayload<{
  include: typeof messageInclude;
}>;

@Injectable()
export class ChatRepository {
  constructor(private readonly prisma: PrismaService) {}

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
}
