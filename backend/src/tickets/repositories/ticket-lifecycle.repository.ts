import { HttpException, Injectable } from '@nestjs/common';
import type { Prisma, Ticket } from '@prisma/client';
import { mapPrismaError } from '../../database/prisma-error';
import { PrismaService } from '../../database/prisma.service';
import { FileAttachmentsRepository } from '../../files/file-attachments.repository';
import type { StoredFileMetadata } from '../../files/file-attachments.repository';
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
    private readonly fileAttachmentsRepository: FileAttachmentsRepository,
  ) {}

  async createWithEvent(
    ticket: CreateTicketInput,
    event: NewSubmissionEvent,
    files: StoredFileMetadata[] = [],
  ): Promise<TicketRecord> {
    return this.inTransaction(async (tx) => {
      const created = await this.ticketsRepository.create(ticket, tx);
      const eventId = await this.ticketEventsRepository.append(
        { ...event, ticketId: created.ticketId },
        tx,
      );
      await this.attachFiles(eventId, files, tx);
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
    files: StoredFileMetadata[] = [],
    attachmentIdsToRemove: string[] = [],
  ): Promise<TicketRecord> {
    return this.inTransaction(async (tx) => {
      const saved = await this.ticketsRepository.save(ticket, tx);
      await this.fileAttachmentsRepository.deleteForTicket(
        event.ticketId,
        attachmentIdsToRemove,
        tx,
      );
      const eventId = await this.ticketEventsRepository.append(event, tx);
      await this.attachFiles(eventId, files, tx);
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

  private async attachFiles(
    eventId: string,
    files: StoredFileMetadata[],
    client: Prisma.TransactionClient,
  ): Promise<void> {
    for (const file of files) {
      await this.fileAttachmentsRepository.createForEvent(eventId, file, client);
    }
  }
}
