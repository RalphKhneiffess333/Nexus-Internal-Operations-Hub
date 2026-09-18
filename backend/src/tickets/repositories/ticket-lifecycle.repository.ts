import { HttpException, Injectable } from '@nestjs/common';
import type { Prisma, Ticket } from '@prisma/client';
import { mapPrismaError } from '../../database/prisma-error';
import { PrismaService } from '../../database/prisma.service';
import {
  NewClaimEvent,
  NewSubmissionEvent,
  NewTicketMutationEvent,
} from '../events/ticket-event.types';
import { TicketEventsRepository } from '../events/ticket-events.repository';
import {
  CreateTicketInput,
  TicketRecord,
  TicketsRepository,
} from './tickets.repository';

@Injectable()
export class TicketLifecycleRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsRepository: TicketsRepository,
    private readonly ticketEventsRepository: TicketEventsRepository,
  ) {}

  async createWithEvent(
    ticket: CreateTicketInput,
    event: NewSubmissionEvent,
  ): Promise<TicketRecord> {
    return this.inTransaction(async (tx) => {
      const created = await this.ticketsRepository.create(ticket, tx);
      await this.ticketEventsRepository.append(
        { ...event, ticketId: created.ticketId },
        tx,
      );
      return created;
    });
  }

  async claimWithEvent(
    ticketId: string,
    agentId: string,
    event: NewClaimEvent,
  ): Promise<TicketRecord | null> {
    return this.inTransaction(async (tx) => {
      const claimed = await this.ticketsRepository.claimIfAvailable(
        ticketId,
        agentId,
        event.createdAt,
        tx,
      );
      if (!claimed) {
        return null;
      }

      await this.ticketEventsRepository.append(event, tx);
      return claimed;
    });
  }

  async saveWithEvent(
    ticket: Ticket,
    event: NewTicketMutationEvent,
  ): Promise<TicketRecord> {
    return this.inTransaction(async (tx) => {
      const saved = await this.ticketsRepository.save(ticket, tx);
      await this.ticketEventsRepository.append(event, tx);
      return saved;
    });
  }

  private async inTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(operation);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      mapPrismaError(error);
    }
  }
}
