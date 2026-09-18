import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mapPrismaError } from '../../database/prisma-error';
import { PrismaService } from '../../database/prisma.service';
import type { TicketPersistenceClient } from '../repositories/tickets.repository';
import type { TicketEventAttachment } from '../../files/file-attachments.repository';
import {
  ClaimEventDetails,
  CloseEventDetails,
  DeleteEventDetails,
  HandoffEventDetails,
  NewTicketEvent,
  ReopenEventDetails,
  SubmissionEventDetails,
  TicketEventRecord,
  TicketEventUser,
} from './ticket-event.types';

const eventUserSelect = {
  userId: true,
  fullName: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;

const eventInclude = {
  user: { select: eventUserSelect },
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
} satisfies Prisma.TicketEventInclude;

type TicketEventWithUser = Prisma.TicketEventGetPayload<{
  include: typeof eventInclude;
}>;

@Injectable()
export class TicketEventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async append(
    event: NewTicketEvent,
    client: TicketPersistenceClient = this.prisma,
  ): Promise<string> {
    try {
      const ticketEventId = randomUUID();
      await client.ticketEvent.create({
        data: {
          ticketEventId,
          ticketId: event.ticketId,
          userId: event.userId,
          action: event.action,
          details: event.details as unknown as Prisma.InputJsonValue,
          createdAt: event.createdAt,
          updatedAt: event.createdAt,
        },
      });
      return ticketEventId;

    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findByTicketId(ticketId: string): Promise<TicketEventRecord[]> {
    try {
      const events = await this.prisma.ticketEvent.findMany({
        where: { ticketId },
        orderBy: [{ createdAt: 'asc' }, { ticketEventId: 'asc' }],
        include: eventInclude,
      });

      return this.withUserReferences(events);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findByIdForTicket(
    ticketId: string,
    ticketEventId: string,
  ): Promise<TicketEventRecord | null> {
    try {
      const event = await this.prisma.ticketEvent.findFirst({
        where: { ticketId, ticketEventId },
        include: eventInclude,
      });

      return event ? (await this.withUserReferences([event]))[0] : null;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  private async withUserReferences(
    events: TicketEventWithUser[],
  ): Promise<TicketEventRecord[]> {
    const referencedUserIds = new Set(
      events.flatMap((event) => [
        event.userId,
        ...this.getDetailUserIds(event),
      ]),
    );
    const users = await this.prisma.user.findMany({
      where: { userId: { in: [...referencedUserIds] } },
      select: eventUserSelect,
    });
    const usersById = new Map(users.map((user) => [user.userId, user]));

    return events.map((event) => {
      const user = event.user;
      const details = event.details as Record<string, unknown>;
      const resolveUser = (userId: string): TicketEventUser => {
        const referencedUser = usersById.get(userId);
        if (!referencedUser) {
          throw new Error(`Ticket event references missing user ${userId}`);
        }
        return referencedUser;
      };

      const responseDetails = (() => {
        switch (event.action) {
          case 'SUBMISSION': {
            const typed = details as unknown as SubmissionEventDetails;
            return {
              title: typed.title,
              departmentId: typed.departmentId,
              priority: typed.priority,
              description: typed.description,
              submitter: resolveUser(typed.submitterId),
            };
          }
          case 'CLAIM': {
            const typed = details as unknown as ClaimEventDetails;
            return {
              agent: resolveUser(typed.agentId),
              timestamp: typed.timestamp,
            };
          }
          case 'CLOSE': {
            const typed = details as unknown as CloseEventDetails;
            return {
              agent: resolveUser(typed.agentId),
              completionNotes: typed.completionNotes,
            };
          }
          case 'REOPEN': {
            const typed = details as unknown as ReopenEventDetails;
            return {
              priority: typed.priority,
              description: typed.description,
              submitter: resolveUser(typed.submitterId),
            };
          }
          case 'DELETE': {
            const typed = details as unknown as DeleteEventDetails;
            return { deletedBy: resolveUser(typed.deletedById) };
          }
          case 'HANDOFF': {
            const typed = details as unknown as HandoffEventDetails;
            return {
              requester: resolveUser(typed.requesterId),
              requestedAgent: resolveUser(typed.requestedAgentId),
              action: typed.action,
              timestamp: typed.timestamp,
            };
          }
          case 'MODIFICATION':
            return details;
        }
      })();

      return {
        ticketEventId: event.ticketEventId,
        ticketId: event.ticketId,
        action: event.action,
        details: responseDetails,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        user,
        attachments: event.attachments.map(
          (attachment): TicketEventAttachment => ({
            attachmentId: attachment.attachmentId,
            fileId: attachment.file.fileId,
            originalName: attachment.file.originalName,
            fileSize: attachment.file.fileSize,
            mimeType: attachment.file.mimeType,
            createdAt: attachment.file.createdAt,
            updatedAt: attachment.file.updatedAt,
          }),
        ),
      } as unknown as TicketEventRecord;
    });
  }

  private getDetailUserIds(event: TicketEventWithUser): string[] {
    const details = event.details as Record<string, unknown>;
    switch (event.action) {
      case 'SUBMISSION':
        return [details.submitterId as string];
      case 'CLAIM':
      case 'CLOSE':
        return [details.agentId as string];
      case 'REOPEN':
        return [details.submitterId as string];
      case 'DELETE':
        return [details.deletedById as string];
      case 'HANDOFF':
        return [details.requesterId as string, details.requestedAgentId as string];
      case 'MODIFICATION':
        return [];
    }
  }
}
