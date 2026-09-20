import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import {
  Prisma,
  TicketEventAction,
  TicketStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { mapPrismaError } from '../../database/prisma-error';

export interface CreateTicketInput {
  title: string;
  description: string;
  priority: string;
  status: TicketStatus;
  departmentId: string;
  submittedBy: string;
  agentId: string | null;
  active: boolean;
  completionNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  unclaimedSince: Date | null;
  lastReminderAt: Date | null;
}

export type TicketMutation = Omit<CreateTicketInput, 'createdAt'> & {
  ticketId: string;
};
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
  department: {
    select: {
      departmentId: true,
      code: true,
      name: true,
    },
  },
} satisfies Prisma.TicketInclude;

const ticketListSelect = {
  ticketId: true,
  ticketCode: true,
  title: true,
  priority: true,
  status: true,
  departmentId: true,
  submittedBy: true,
  agentId: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  submitter: {
    select: {
      userId: true,
      fullName: true,
    },
  },
  agent: {
    select: {
      userId: true,
      fullName: true,
    },
  },
  department: {
    select: {
      departmentId: true,
      code: true,
      name: true,
    },
  },
} satisfies Prisma.TicketSelect;

const ticketChatContextSelect = {
  ticketId: true,
  ticketCode: true,
  title: true,
  status: true,
  active: true,
  submittedBy: true,
  agentId: true,
  departmentId: true,
  submitter: {
    select: {
      userId: true,
      fullName: true,
    },
  },
  agent: {
    select: {
      userId: true,
      fullName: true,
    },
  },
} satisfies Prisma.TicketSelect;

export type TicketRecord = Prisma.TicketGetPayload<{
  include: typeof ticketInclude;
}>;

export type TicketListRecord = Prisma.TicketGetPayload<{
  select: typeof ticketListSelect;
}>;

export type TicketChatContextRecord = Prisma.TicketGetPayload<{
  select: typeof ticketChatContextSelect;
}>;

export interface TicketListPage {
  items: TicketListRecord[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface TicketFilters {
  scope?: 'all' | 'submitted' | 'claimed' | 'resolved' | 'department' | 'pool';
  search?: string;
  status?: TicketStatus;
  departmentId?: string;
  priority?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
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

  async findChatContext(
    ticketId: string,
  ): Promise<TicketChatContextRecord | null> {
    try {
      return await this.prisma.ticket.findUnique({
        where: { ticketId },
        select: ticketChatContextSelect,
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

  async findList(
    scope: NonNullable<TicketFilters['scope']>,
    actorId: string,
    actorRole: UserRole,
    actorDepartmentIds: string[],
    filters: TicketFilters = {},
  ): Promise<TicketListPage> {
    const page = Math.max(filters.page ?? 1, 1);
    const pageSize = Math.min(Math.max(filters.pageSize ?? 50, 1), 100);
    const activeWhere =
      actorRole === UserRole.Admin && filters.includeInactive === true
        ? {}
        : { active: true };
    const scopedDepartmentIds = filters.departmentId
      ? actorDepartmentIds.filter(
          (departmentId) => departmentId === filters.departmentId,
        )
      : actorDepartmentIds;

    if (
      (scope === 'department' || scope === 'pool') &&
      scopedDepartmentIds.length === 0
    ) {
      return { items: [], page, pageSize, hasMore: false };
    }

    const scopeWhere: Prisma.TicketWhereInput = (() => {
      switch (scope) {
        case 'submitted':
          return { submittedBy: actorId };
        case 'claimed':
          return { agentId: actorId };
        case 'resolved':
          return {
            events: {
              some: { action: TicketEventAction.CLOSE, userId: actorId },
            },
          };
        case 'department':
          return { departmentId: { in: scopedDepartmentIds } };
        case 'pool':
          return {
            agentId: null,
            status: filters.status ?? {
              in: [TicketStatus.OPEN, TicketStatus.REOPENED],
            },
            departmentId: { in: scopedDepartmentIds },
          };
        case 'all':
        default:
          if (actorRole === UserRole.Admin) return {};
          return {
            OR: [
              { submittedBy: actorId },
              ...(actorRole === UserRole.Agent && actorDepartmentIds.length > 0
                ? [{ departmentId: { in: actorDepartmentIds } }]
                : []),
            ],
          };
      }
    })();

    if (
      scope === 'pool' &&
      filters.status &&
      filters.status !== TicketStatus.OPEN &&
      filters.status !== TicketStatus.REOPENED
    ) {
      return { items: [], page, pageSize, hasMore: false };
    }

    try {
      const records = await this.prisma.ticket.findMany({
        where: {
          ...activeWhere,
          ...scopeWhere,
          ...ticketFilterWhere(filters),
        },
        orderBy: [{ updatedAt: 'desc' }, { ticketId: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
        select: ticketListSelect,
      });
      return {
        items: records.slice(0, pageSize),
        page,
        pageSize,
        hasMore: records.length > pageSize,
      };
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async countPool(actorDepartmentIds: string[]): Promise<number> {
    if (actorDepartmentIds.length === 0) return 0;
    try {
      return await this.prisma.ticket.count({
        where: {
          active: true,
          agentId: null,
          status: { in: [TicketStatus.OPEN, TicketStatus.REOPENED] },
          departmentId: { in: actorDepartmentIds },
        },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findActiveClaimedByAgentInDepartment(
    agentId: string,
    departmentId: string,
    client: Prisma.TransactionClient,
  ): Promise<Array<{ ticketId: string }>> {
    try {
      return await client.ticket.findMany({
        where: {
          departmentId,
          agentId,
          active: true,
          status: TicketStatus.CLAIMED,
        },
        select: { ticketId: true },
        orderBy: { ticketId: 'asc' },
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
          unclaimedSince: ticket.unclaimedSince,
          lastReminderAt: ticket.lastReminderAt,
        },
        include: ticketInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async save(
    ticket: TicketMutation,
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
          unclaimedSince: ticket.unclaimedSince,
          lastReminderAt: ticket.lastReminderAt,
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
          unclaimedSince: null,
          lastReminderAt: null,
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

  async transferClaimed(
    ticketId: string,
    agentId: string,
    updatedAt: Date,
    client: Prisma.TransactionClient,
  ): Promise<TicketRecord> {
    try {
      return await client.ticket.update({
        where: { ticketId },
        data: {
          agentId,
          status: TicketStatus.CLAIMED,
          updatedAt,
        },
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
