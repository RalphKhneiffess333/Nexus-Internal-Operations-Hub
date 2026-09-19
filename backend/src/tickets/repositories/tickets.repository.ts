import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import {
  Prisma,
  Ticket,
  TicketEventAction,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
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

export interface TicketFilters {
  search?: string;
  status?: TicketStatus;
  departmentId?: string;
  priority?: TicketPriority;
}

function ticketFilterWhere(filters: TicketFilters): Prisma.TicketWhereInput {
  const search = filters.search?.trim();

  return {
    ...(search
      ? {
          OR: [
            { ticketCode: { contains: search, mode: 'insensitive' } },
            { title: { contains: search, mode: 'insensitive' } },
            {
              submitter: {
                fullName: { contains: search, mode: 'insensitive' },
              },
            },
          ],
        }
      : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
  };
}

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

  async findByIdForUpdate(
    ticketId: string,
    client: Prisma.TransactionClient,
  ): Promise<TicketRecord | null> {
    try {
      await client.$queryRaw`
        SELECT "ticket_id"
        FROM "tickets"
        WHERE "ticket_id" = ${ticketId}
        FOR UPDATE
      `;
      return await client.ticket.findUnique({
        where: { ticketId },
        include: ticketInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findAll(filters: TicketFilters = {}): Promise<TicketRecord[]> {
    try {
      return await this.prisma.ticket.findMany({
        where: ticketFilterWhere(filters),
        include: ticketInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findActive(filters: TicketFilters = {}): Promise<TicketRecord[]> {
    try {
      return await this.prisma.ticket.findMany({
        where: { active: true, ...ticketFilterWhere(filters) },
        orderBy: { createdAt: 'desc' },
        include: ticketInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findActiveBySubmitter(
    submittedBy: string,
    filters: TicketFilters = {},
  ): Promise<TicketRecord[]> {
    try {
      return await this.prisma.ticket.findMany({
        where: {
          active: true,
          submittedBy,
          ...ticketFilterWhere(filters),
        },
        orderBy: { createdAt: 'desc' },
        include: ticketInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findActiveByAgent(
    agentId: string,
    filters: TicketFilters = {},
  ): Promise<TicketRecord[]> {
    try {
      return await this.prisma.ticket.findMany({
        where: {
          active: true,
          agentId,
          ...ticketFilterWhere(filters),
        },
        orderBy: { updatedAt: 'desc' },
        include: ticketInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findActiveResolvedByAgent(
    agentId: string,
    filters: TicketFilters = {},
  ): Promise<TicketRecord[]> {
    try {
      const closeEvents = await this.prisma.ticketEvent.findMany({
        where: {
          action: TicketEventAction.CLOSE,
          userId: agentId,
          ticket: { active: true, ...ticketFilterWhere(filters) },
        },
        select: {
          ticketId: true,
        },
      });
      const resolvedTicketIds = [
        ...new Set(closeEvents.map((event) => event.ticketId)),
      ];

      if (resolvedTicketIds.length === 0) {
        return [];
      }

      return await this.prisma.ticket.findMany({
        where: {
          active: true,
          ticketId: { in: resolvedTicketIds },
          ...ticketFilterWhere(filters),
        },
        orderBy: { updatedAt: 'desc' },
        include: ticketInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findActiveByDepartmentIds(
    departmentIds: string[],
    filters: TicketFilters = {},
  ): Promise<TicketRecord[]> {
    const scopedDepartmentIds = filters.departmentId
      ? departmentIds.filter(
          (departmentId) => departmentId === filters.departmentId,
        )
      : departmentIds;

    if (scopedDepartmentIds.length === 0) {
      return [];
    }

    try {
      return await this.prisma.ticket.findMany({
        where: {
          active: true,
          ...ticketFilterWhere(filters),
          departmentId: { in: scopedDepartmentIds },
        },
        orderBy: { createdAt: 'desc' },
        include: ticketInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findTicketPool(
    departmentIds?: string[],
    filters: TicketFilters = {},
  ): Promise<TicketRecord[]> {
    if (
      filters.status &&
      filters.status !== TicketStatus.OPEN &&
      filters.status !== TicketStatus.REOPENED
    ) {
      return [];
    }

    const scopedDepartmentIds =
      departmentIds && filters.departmentId
        ? departmentIds.filter(
            (departmentId) => departmentId === filters.departmentId,
          )
        : departmentIds;

    if (scopedDepartmentIds && scopedDepartmentIds.length === 0) {
      return [];
    }

    try {
      return await this.prisma.ticket.findMany({
        where: {
          active: true,
          agentId: null,
          ...ticketFilterWhere(filters),
          status: filters.status ?? {
            in: [TicketStatus.OPEN, TicketStatus.REOPENED],
          },
          ...(scopedDepartmentIds
            ? {
                departmentId: {
                  in: scopedDepartmentIds,
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
