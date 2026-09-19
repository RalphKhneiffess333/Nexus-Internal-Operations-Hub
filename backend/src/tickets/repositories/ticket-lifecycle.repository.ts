import { ConflictException, HttpException, Injectable } from '@nestjs/common';
import { Prisma, Ticket, TicketEventAction } from '@prisma/client';
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
import { HandoffsService } from '../handoffs/handoffs.service';

export interface TicketLifecycleResult {
  ticket: TicketRecord;
  ticketEventId: string;
}

@Injectable()
export class TicketLifecycleRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsRepository: TicketsRepository,
    private readonly ticketEventsRepository: TicketEventsRepository,
    private readonly fileAttachmentsRepository: FileAttachmentsRepository,
    private readonly handoffsService: HandoffsService,
  ) {}

  async createWithEvent(
    ticket: CreateTicketInput,
    event: NewSubmissionEvent,
    files: StoredFileMetadata[] = [],
  ): Promise<TicketLifecycleResult> {
    return this.inTransaction(async (tx) => {
      const created = await this.ticketsRepository.create(ticket, tx);
      const eventId = await this.ticketEventsRepository.append(
        { ...event, ticketId: created.ticketId },
        tx,
      );
      await this.attachFiles(eventId, files, tx);
      return { ticket: created, ticketEventId: eventId };
    });
  }

  async claimWithEvent(
    ticketId: string,
    agentId: string,
    event: NewClaimEvent,
  ): Promise<TicketLifecycleResult | null> {
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

      const ticketEventId = await this.ticketEventsRepository.append(event, tx);
      return { ticket: claimed, ticketEventId };
    });
  }

  async saveWithEvent(
    ticket: Ticket,
    event: NewTicketMutationEvent,
    files: StoredFileMetadata[] = [],
    attachmentIdsToRemove: string[] = [],
    allowAdminCloseOverride = false,
  ): Promise<TicketLifecycleResult> {
    return this.inTransaction(async (tx) => {
      const current = await this.ticketsRepository.findByIdForUpdate(
        ticket.ticketId,
        tx,
      );
      if (!current) {
        throw new ConflictException('The ticket no longer exists');
      }
      if (
        event.action === TicketEventAction.CLOSE &&
        (current.status !== 'CLAIMED' ||
          (current.agentId !== event.userId && !allowAdminCloseOverride))
      ) {
        throw new ConflictException(
          'The ticket changed before it could be closed',
        );
      }
      const saved = await this.ticketsRepository.save(ticket, tx);
      await this.fileAttachmentsRepository.deleteForTicket(
        event.ticketId,
        attachmentIdsToRemove,
        tx,
      );
      const eventId = await this.ticketEventsRepository.append(event, tx);
      if (event.action === TicketEventAction.CLOSE || !ticket.active) {
        await this.handoffsService.cancelPendingForTicket(
          ticket.ticketId,
          event.userId,
          event.action === TicketEventAction.CLOSE
            ? 'TICKET_CLOSED'
            : 'TICKET_CANCELLED',
          tx,
        );
      }
      await this.attachFiles(eventId, files, tx);
      return { ticket: saved, ticketEventId: eventId };
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
      await this.fileAttachmentsRepository.createForEvent(
        eventId,
        file,
        client,
      );
    }
  }
}
