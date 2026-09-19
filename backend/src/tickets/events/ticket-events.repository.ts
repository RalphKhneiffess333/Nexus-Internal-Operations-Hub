import { randomUUID } from 'crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Prisma, TicketEventAction, TicketPriority } from '@prisma/client';
import { mapPrismaError } from '../../database/prisma-error';
import { PrismaService } from '../../database/prisma.service';
import type { TicketPersistenceClient } from '../repositories/tickets.repository';
import type { TicketEventAttachment } from '../../files/file-attachments.repository';
import {
  HandoffEventDetails,
  ModificationEventDetails,
  NewTicketEvent,
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
          details: this.toInputJson(event.details),
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

  async findAll(
    skip = 0,
    take = 100,
    action?: TicketEventAction,
  ): Promise<TicketEventRecord[]> {
    try {
      const events = await this.prisma.ticketEvent.findMany({
        where: action ? { action } : undefined,
        orderBy: [{ createdAt: 'desc' }, { ticketEventId: 'desc' }],
        skip,
        take,
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
      const details = this.readDetails(event.details);
      const resolveUser = (userId: string): TicketEventUser => {
        const referencedUser = usersById.get(userId);
        if (!referencedUser) {
          throw new Error(`Ticket event references missing user ${userId}`);
        }
        return referencedUser;
      };

      const base = {
        ticketEventId: event.ticketEventId,
        ticketId: event.ticketId,
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
      };

      switch (event.action) {
        case 'SUBMISSION':
          return {
            ...base,
            action: event.action,
            details: {
              title: this.stringDetail(details, 'title'),
              departmentId: this.stringDetail(details, 'departmentId'),
              priority: this.ticketPriorityDetail(details, 'priority'),
              description: this.stringDetail(details, 'description'),
              submitter: resolveUser(this.stringDetail(details, 'submitterId')),
            },
          };
        case 'CLAIM':
          return {
            ...base,
            action: event.action,
            details: {
              agent: resolveUser(this.stringDetail(details, 'agentId')),
              timestamp: this.stringDetail(details, 'timestamp'),
            },
          };
        case 'CLOSE':
          return {
            ...base,
            action: event.action,
            details: {
              agent: resolveUser(this.stringDetail(details, 'agentId')),
              completionNotes: this.nullableStringDetail(details, 'completionNotes'),
            },
          };
        case 'REOPEN':
          return {
            ...base,
            action: event.action,
            details: {
              priority: this.ticketPriorityDetail(details, 'priority'),
              description: this.stringDetail(details, 'description'),
              submitter: resolveUser(this.stringDetail(details, 'submitterId')),
            },
          };
        case 'DELETE':
          return {
            ...base,
            action: event.action,
            details: {
              deletedBy: resolveUser(this.stringDetail(details, 'deletedById')),
            },
          };
        case 'HANDOFF': {
          const handoffId = this.optionalStringDetail(details, 'handoffId');
          const message = this.optionalStringDetail(details, 'message');
          const reason = this.optionalStringDetail(details, 'reason');
          return {
            ...base,
            action: event.action,
            details: {
              ...(handoffId ? { handoffId } : {}),
              requester: resolveUser(this.stringDetail(details, 'requesterId')),
              requestedAgent: resolveUser(
                this.stringDetail(details, 'requestedAgentId'),
              ),
              action: this.handoffActionDetail(details),
              ...(message ? { message } : {}),
              ...(reason ? { reason } : {}),
              timestamp: this.stringDetail(details, 'timestamp'),
            },
          };
        }
        case 'MODIFICATION':
          return {
            ...base,
            action: event.action,
            details: this.modificationDetails(details),
          };
      }
    });
  }

  private getDetailUserIds(event: TicketEventWithUser): string[] {
    const details = this.readDetails(event.details);
    switch (event.action) {
      case 'SUBMISSION':
        return [this.stringDetail(details, 'submitterId')];
      case 'CLAIM':
      case 'CLOSE':
        return [this.stringDetail(details, 'agentId')];
      case 'REOPEN':
        return [this.stringDetail(details, 'submitterId')];
      case 'DELETE':
        return [this.stringDetail(details, 'deletedById')];
      case 'HANDOFF':
        return [
          this.stringDetail(details, 'requesterId'),
          this.stringDetail(details, 'requestedAgentId'),
        ];
      case 'MODIFICATION':
        return [];
    }
  }

  private toInputJson(details: NewTicketEvent['details']): Prisma.InputJsonValue {
    const json: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(details)) {
      if (value === null) {
        json[key] = null;
      } else if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        json[key] = value;
      } else {
        throw new InternalServerErrorException(
          'Ticket event details are invalid',
        );
      }
    }
    // Prisma's nested JSON input type omits JavaScript null even though the
    // database accepts it; all values were narrowed above before this boundary.
    return json as Prisma.InputJsonValue;
  }

  private modificationDetails(
    details: Record<string, unknown>,
  ): ModificationEventDetails {
    return {
      oldTitle: this.stringDetail(details, 'oldTitle'),
      newTitle: this.stringDetail(details, 'newTitle'),
      oldDepartmentId: this.stringDetail(details, 'oldDepartmentId'),
      newDepartmentId: this.stringDetail(details, 'newDepartmentId'),
      oldPriority: this.ticketPriorityDetail(details, 'oldPriority'),
      newPriority: this.ticketPriorityDetail(details, 'newPriority'),
      oldDescription: this.stringDetail(details, 'oldDescription'),
      newDescription: this.stringDetail(details, 'newDescription'),
    };
  }

  private readDetails(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new InternalServerErrorException('Ticket event details are invalid');
    }
    return value as Record<string, unknown>;
  }

  private stringDetail(details: Record<string, unknown>, key: string): string {
    const value = details[key];
    if (typeof value !== 'string' || !value) {
      throw new InternalServerErrorException('Ticket event details are invalid');
    }
    return value;
  }

  private optionalStringDetail(
    details: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = details[key];
    if (value === undefined) return undefined;
    return this.stringDetail(details, key);
  }

  private nullableStringDetail(
    details: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = details[key];
    if (value === null) return null;
    return this.stringDetail(details, key);
  }

  private ticketPriorityDetail(
    details: Record<string, unknown>,
    key: string,
  ): TicketPriority {
    const value = this.stringDetail(details, key);
    if (!['LOW', 'MODERATE', 'HIGH'].includes(value)) {
      throw new InternalServerErrorException('Ticket event details are invalid');
    }
    return value as TicketPriority;
  }

  private handoffActionDetail(
    details: Record<string, unknown>,
  ): HandoffEventDetails['action'] {
    const value = this.stringDetail(details, 'action');
    if (!['REQUESTED', 'ACCEPTED', 'REJECTED', 'DENIED', 'CANCELLED'].includes(value)) {
      throw new InternalServerErrorException('Ticket event details are invalid');
    }
    return value as HandoffEventDetails['action'];
  }
}
