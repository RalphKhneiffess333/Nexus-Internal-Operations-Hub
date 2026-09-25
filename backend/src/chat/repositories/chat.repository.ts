import { randomUUID } from 'node:crypto';
import { HttpException, Injectable } from '@nestjs/common';
import { Prisma, TicketStatus, UserRole } from '@prisma/client';
import { mapPrismaError } from '../../database/prisma-error';
import { PrismaService } from '../../database/prisma.service';

const senderSelect = {
  userId: true,
  fullName: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;

const senderReferenceSelect = {
  userId: true,
  fullName: true,
} satisfies Prisma.UserSelect;

const messageListInclude = {
  sender: { select: senderReferenceSelect },
  attachments: {
    include: {
      file: {
        select: {
          originalName: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ChatMessageInclude;

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

export type ChatMessageListRecord = Prisma.ChatMessageGetPayload<{
  include: typeof messageListInclude;
}>;

export interface ChatMessageListPage {
  items: ChatMessageListRecord[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ChatInboxTicketRecord {
  ticketId: string;
  ticketCode: string;
  title: string;
  status: TicketStatus;
  chatMessages: Array<{
    messageId: string;
    senderId: string;
    content: string | null;
    createdAt: Date;
    sender: { userId: string; fullName: string };
    attachments: Array<{ attachmentId: string }>;
  }>;
  chatReadReceipts: Array<{ lastReadAt: Date }>;
}

export interface ChatInboxPage {
  items: ChatInboxTicketRecord[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

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

  async findByTicketId(
    ticketId: string,
    page = 1,
    pageSize = 50,
  ): Promise<ChatMessageListPage> {
    const safePageSize = Math.min(Math.max(pageSize, 1), 100);
    const safePage = Math.max(page, 1);
    try {
      const messages = await this.prisma.chatMessage.findMany({
        where: { ticketId },
        orderBy: [{ createdAt: 'desc' }, { messageId: 'desc' }],
        skip: (safePage - 1) * safePageSize,
        take: safePageSize + 1,
        include: messageListInclude,
      });
      return {
        items: messages.slice(0, safePageSize).reverse(),
        page: safePage,
        pageSize: safePageSize,
        hasMore: messages.length > safePageSize,
      };
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

  async findInboxTickets(
    userId: string,
    actorRole: UserRole,
    page = 1,
    pageSize = 50,
    search?: string,
  ): Promise<ChatInboxPage> {
    const safePageSize = Math.min(Math.max(pageSize, 1), 100);
    const safePage = Math.max(page, 1);
    try {
      const visibility =
        actorRole === UserRole.Employee
          ? Prisma.sql`AND t."submitted_by" = ${userId}`
          : Prisma.sql`
              AND (
                t."agent_id" = ${userId}
                OR EXISTS (
                  SELECT 1
                  FROM "ticket_events" ownership_event
                  WHERE ownership_event."ticket_id" = t."ticket_id"
                    AND (
                      (
                        ownership_event.action::text = 'CLAIM'
                        AND ownership_event.details ->> 'agentId' = ${userId}
                      )
                      OR (
                        ownership_event.action::text = 'HANDOFF'
                        AND (
                          ownership_event.details ->> 'requesterId' = ${userId}
                          OR (
                            ownership_event.details ->> 'action' = 'ACCEPTED'
                            AND ownership_event.details ->> 'requestedAgentId' = ${userId}
                          )
                        )
                      )
                    )
                )
              )
            `;
      const trimmedSearch = search?.trim();
      const searchFilter = trimmedSearch
        ? Prisma.sql`
            AND (
              POSITION(LOWER(${trimmedSearch}) IN LOWER(t.ticket_code)) > 0
              OR POSITION(LOWER(${trimmedSearch}) IN LOWER(t.title)) > 0
              OR POSITION(LOWER(${trimmedSearch}) IN LOWER(latest.content)) > 0
              OR POSITION(LOWER(${trimmedSearch}) IN LOWER(sender.full_name)) > 0
            )
          `
        : Prisma.empty;
      const rows = await this.prisma.$queryRaw<
        Array<{
          ticketId: string;
          ticketCode: string;
          title: string;
          status: string;
          messageId: string | null;
          senderId: string | null;
          senderFullName: string | null;
          content: string | null;
          createdAt: Date | null;
          hasAttachments: boolean | null;
          lastReadAt: Date | null;
        }>
      >(Prisma.sql`
        SELECT
          t.ticket_id AS "ticketId",
          t.ticket_code AS "ticketCode",
          t.title,
          t.status::text AS "status",
          latest.message_id AS "messageId",
          latest.sender_id AS "senderId",
          sender.full_name AS "senderFullName",
          latest.content,
          latest.created_at AS "createdAt",
          latest.has_attachments AS "hasAttachments",
          receipt.last_read_at AS "lastReadAt"
        FROM "tickets" t
        LEFT JOIN LATERAL (
          SELECT
            cm.message_id,
            cm.sender_id,
            cm.content,
            cm.created_at,
            EXISTS (
              SELECT 1
              FROM "attachments" a
              WHERE a.message_id = cm.message_id
            ) AS has_attachments
          FROM "chat_messages" cm
          WHERE cm.ticket_id = t.ticket_id
          ORDER BY cm.created_at DESC, cm.message_id DESC
          LIMIT 1
        ) latest ON TRUE
        LEFT JOIN "users" sender ON sender.user_id = latest.sender_id
        LEFT JOIN "chat_read_receipts" receipt
          ON receipt.ticket_id = t.ticket_id
          AND receipt.user_id = ${userId}
        WHERE t.active = TRUE
          AND latest.message_id IS NOT NULL
          ${visibility} ${searchFilter}
        ORDER BY
          latest.created_at DESC NULLS LAST,
          latest.message_id DESC NULLS LAST,
          t.updated_at DESC,
          t.ticket_id DESC
         OFFSET ${(safePage - 1) * safePageSize}
         LIMIT ${safePageSize + 1}
      `);

      const items = rows.slice(0, safePageSize).map((row) => ({
        ticketId: row.ticketId,
        ticketCode: row.ticketCode,
        title: row.title,
        status: row.status as TicketStatus,
        chatMessages: row.messageId
          ? [
              {
                messageId: row.messageId,
                senderId: row.senderId!,
                content: row.content,
                createdAt: row.createdAt!,
                sender: {
                  userId: row.senderId!,
                  fullName: row.senderFullName ?? 'Unknown user',
                },
                attachments: row.hasAttachments
                  ? [{ attachmentId: 'has-attachment' }]
                  : [],
              },
            ]
          : [],
        chatReadReceipts: row.lastReadAt
          ? [{ lastReadAt: row.lastReadAt }]
          : [],
      }));
      return {
        items,
        page: safePage,
        pageSize: safePageSize,
        hasMore: rows.length > safePageSize,
      };
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
