import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, Ticket, TicketStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { mapPrismaError } from '../../database/prisma-error';

export type CreateTicketInput = Omit<Ticket, 'ticketId' | 'ticketCode'>;
export type TicketPersistenceClient = PrismaService | Prisma.TransactionClient;

const ticketInclude = {
  submitter: {
    select: {
      fullName: true,
      email: true,
    },
  },
  agent: {
    select: {
      fullName: true,
      email: true,
    },
  },
} satisfies Prisma.TicketInclude;

export type TicketRecord = Prisma.TicketGetPayload<{
  include: typeof ticketInclude;
}>;

@Injectable()
export class TicketsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(ticketId: string): Promise<TicketRecord | null> {
    try {
      return await this.prisma.ticket.findUnique({
        where: { ticketId },
        include: ticketInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findAll(): Promise<TicketRecord[]> {
    try {
      return await this.prisma.ticket.findMany({
        include: ticketInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findActive(): Promise<TicketRecord[]> {
    try {
      return await this.prisma.ticket.findMany({
        where: { active: true },
        orderBy: { createdAt: 'desc' },
        include: ticketInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findActiveBySubmitter(submittedBy: string): Promise<TicketRecord[]> {
    try {
      return await this.prisma.ticket.findMany({
        where: {
          active: true,
          submittedBy,
        },
        orderBy: { createdAt: 'desc' },
        include: ticketInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findActiveByDepartmentIds(
    departmentIds: string[],
  ): Promise<TicketRecord[]> {
    if (departmentIds.length === 0) {
      return [];
    }

    try {
      return await this.prisma.ticket.findMany({
        where: {
          active: true,
          departmentId: {
            in: departmentIds,
          },
        },
        orderBy: { createdAt: 'desc' },
        include: ticketInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findTicketPool(departmentIds?: string[]): Promise<TicketRecord[]> {
    if (departmentIds && departmentIds.length === 0) {
      return [];
    }

    try {
      return await this.prisma.ticket.findMany({
        where: {
          active: true,
          agentId: null,
          status: {
            in: [TicketStatus.OPEN, TicketStatus.REOPENED],
          },
          ...(departmentIds
            ? {
                departmentId: {
                  in: departmentIds,
                },
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: ticketInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async create(
    ticket: CreateTicketInput,
    client: TicketPersistenceClient = this.prisma,
  ): Promise<TicketRecord> {
    try {
      const sequence = await this.nextTicketSequence(client);
      const ticketCode = `TKT-${String(sequence).padStart(4, '0')}`;

      return await client.ticket.create({
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
        include: ticketInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async save(
    ticket: Ticket,
    client: TicketPersistenceClient = this.prisma,
  ): Promise<TicketRecord> {
    try {
      return await client.ticket.update({
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
        include: ticketInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async claimIfAvailable(
    ticketId: string,
    agentId: string,
    updatedAt = new Date(),
    client: TicketPersistenceClient = this.prisma,
  ): Promise<TicketRecord | null> {
    try {
      const result = await client.ticket.updateMany({
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
          updatedAt,
        },
      });

      if (result.count === 0) {
        return null;
      }

      return client.ticket.findUnique({
        where: { ticketId },
        include: ticketInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  private async nextTicketSequence(
    client: TicketPersistenceClient,
  ): Promise<number> {
    const rows = await client.$queryRaw<Array<{ nextval: bigint }>>`
      SELECT nextval('ticket_code_seq') AS nextval
    `;
    return Number(rows[0].nextval);
  }
}
