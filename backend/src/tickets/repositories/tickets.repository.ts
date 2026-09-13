import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, Ticket, TicketStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { mapPrismaError } from '../../database/prisma-error';

export type CreateTicketInput = Omit<Ticket, 'ticketId' | 'ticketCode'>;

@Injectable()
export class TicketsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(ticketId: string): Promise<Ticket | null> {
    try {
      return await this.prisma.ticket.findUnique({
        where: { ticketId },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findAll(): Promise<Ticket[]> {
    try {
      return await this.prisma.ticket.findMany();
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async create(ticket: CreateTicketInput): Promise<Ticket> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const sequence = await this.nextTicketSequence(tx);
        const ticketCode = `TKT-${String(sequence).padStart(4, '0')}`;

        return tx.ticket.create({
          data: {
            ticketId: randomUUID(),
            ticketCode,
            title: ticket.title,
            description: ticket.description,
            priority: ticket.priority,
            status: ticket.status,
            departmentId: ticket.departmentId,
            submittedBy: ticket.submittedBy,
            agentId: ticket.agentId,
            active: ticket.active,
            completionNotes: ticket.completionNotes,
            createdAt: ticket.createdAt,
            updatedAt: ticket.updatedAt,
            closedAt: ticket.closedAt,
          },
        });
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async save(ticket: Ticket): Promise<Ticket> {
    try {
      return await this.prisma.ticket.update({
        where: { ticketId: ticket.ticketId },
        data: {
          title: ticket.title,
          description: ticket.description,
          priority: ticket.priority,
          status: ticket.status,
          departmentId: ticket.departmentId,
          submittedBy: ticket.submittedBy,
          agentId: ticket.agentId,
          active: ticket.active,
          completionNotes: ticket.completionNotes,
          updatedAt: ticket.updatedAt,
          closedAt: ticket.closedAt,
        },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async claimIfAvailable(
    ticketId: string,
    agentId: string,
  ): Promise<Ticket | null> {
    try {
      const result = await this.prisma.ticket.updateMany({
        where: {
          ticketId,
          active: true,
          agentId: null,
          status: {
            in: [TicketStatus.OPEN, TicketStatus.REOPENED],
          },
        },
        data: {
          status: TicketStatus.CLAIMED,
          agentId,
        },
      });

      if (result.count === 0) {
        return null;
      }

      return this.prisma.ticket.findUnique({
        where: { ticketId },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  private async nextTicketSequence(
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ nextval: bigint }>>`
      SELECT nextval('ticket_code_seq') AS nextval
    `;
    return Number(rows[0].nextval);
  }
}
