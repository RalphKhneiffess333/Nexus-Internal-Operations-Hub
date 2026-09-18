import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, TicketEvent } from '@prisma/client';
import { mapPrismaError } from '../../database/prisma-error';
import { PrismaService } from '../../database/prisma.service';
import type { TicketPersistenceClient } from '../repositories/tickets.repository';
import { NewTicketEvent, TicketEventRecord } from './ticket-event.types';

@Injectable()
export class TicketEventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async append(
    event: NewTicketEvent,
    client: TicketPersistenceClient = this.prisma,
  ): Promise<TicketEventRecord> {
    try {
      const created = await client.ticketEvent.create({
        data: {
          ticketEventId: randomUUID(),
          ticketId: event.ticketId,
          userId: event.userId,
          action: event.action,
          details: event.details as unknown as Prisma.InputJsonValue,
          createdAt: event.createdAt,
          updatedAt: event.createdAt,
        },
      });

      return this.toRecord(created);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findByTicketId(ticketId: string): Promise<TicketEventRecord[]> {
    try {
      const events = await this.prisma.ticketEvent.findMany({
        where: { ticketId },
        orderBy: [{ createdAt: 'asc' }, { ticketEventId: 'asc' }],
      });

      return events.map((event) => this.toRecord(event));
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
      });

      return event ? this.toRecord(event) : null;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  private toRecord(event: TicketEvent): TicketEventRecord {
    return event as unknown as TicketEventRecord;
  }
}
