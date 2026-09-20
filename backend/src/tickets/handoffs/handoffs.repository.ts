import { HttpException, Injectable } from '@nestjs/common';
import {
  HandoffStatus,
  Prisma,
  Ticket,
  TicketEventAction,
  User,
  UserRole,
} from '@prisma/client';
import { TicketEventsRepository } from '../events/ticket-events.repository';
import { mapPrismaError } from '../../database/prisma-error';
import { PrismaService } from '../../database/prisma.service';

export type HandoffPersistenceClient = PrismaService | Prisma.TransactionClient;

const handoffUserSelect = {
  userId: true,
  fullName: true,
  email: true,
  role: true,
  isActive: true,
} satisfies Prisma.UserSelect;

const handoffListUserSelect = {
  userId: true,
  fullName: true,
} satisfies Prisma.UserSelect;

const handoffInclude = {
  requester: { select: handoffUserSelect },
  requestedAgent: { select: handoffUserSelect },
  ticket: {
    select: {
      ticketId: true,
      ticketCode: true,
      title: true,
      status: true,
      active: true,
      agentId: true,
      departmentId: true,
      department: { select: { departmentId: true, code: true, name: true } },
      agent: { select: handoffUserSelect },
    },
  },
} satisfies Prisma.HandoffRequestInclude;

const handoffListInclude = {
  requester: { select: handoffListUserSelect },
  requestedAgent: { select: handoffListUserSelect },
  ticket: {
    select: {
      ticketId: true,
      ticketCode: true,
      title: true,
      status: true,
      active: true,
      agentId: true,
      departmentId: true,
      department: { select: { departmentId: true, code: true, name: true } },
      agent: { select: handoffListUserSelect },
    },
  },
} satisfies Prisma.HandoffRequestInclude;

export type HandoffRecord = Prisma.HandoffRequestGetPayload<{
  include: typeof handoffInclude;
}>;

export type HandoffListRecord = Prisma.HandoffRequestGetPayload<{
  include: typeof handoffListInclude;
}>;

export type HandoffUserRecord = Prisma.UserGetPayload<{
  select: typeof handoffUserSelect;
}>;

export interface HandoffListQuery {
  userId?: string;
  direction?: 'incoming' | 'outgoing' | 'all';
  ticketId?: string;
  status?: HandoffStatus;
  search?: string;
  departmentId?: string;
  requesterId?: string;
  requestedAgentId?: string;
  page?: number;
  pageSize?: number;
}

export interface HandoffListPage {
  items: HandoffListRecord[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  pendingCount: number;
}

@Injectable()
export class HandoffsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketEventsRepository: TicketEventsRepository,
  ) {}

  async transaction<T>(
    operation: (client: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(operation);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      mapPrismaError(error);
    }
  }

  async cancelPendingForTicket(
    ticketId: string,
    actorId: string,
    reason: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    const pending = await this.findPendingByTicketId(ticketId, client);
    for (const handoff of pending) {
      const now = new Date();
      await this.updateStatus(
        handoff.handoffId,
        HandoffStatus.CANCELLED,
        now,
        client,
      );
      await this.ticketEventsRepository.append(
        {
          ticketId,
          userId: actorId,
          action: TicketEventAction.HANDOFF,
          details: {
            handoffId: handoff.handoffId,
            requesterId: handoff.requesterId,
            requestedAgentId: handoff.requestedAgentId,
            action: 'CANCELLED',
            reason,
            timestamp: now.toISOString(),
          },
          createdAt: now,
        },
        client,
      );
    }
  }

  async findById(
    handoffId: string,
    client: HandoffPersistenceClient = this.prisma,
  ): Promise<HandoffRecord | null> {
    try {
      return await client.handoffRequest.findUnique({
        where: { handoffId },
        include: handoffInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findByIdForUpdate(
    handoffId: string,
    client: Prisma.TransactionClient,
  ): Promise<HandoffRecord | null> {
    try {
      await client.$queryRaw`
        SELECT "handoff_id"
        FROM "handoff_requests"
        WHERE "handoff_id" = ${handoffId}
        FOR UPDATE
      `;
      return await this.findById(handoffId, client);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findList(query: HandoffListQuery): Promise<HandoffListPage> {
    const page = Math.max(query.page ?? 1, 1);
    const pageSize = Math.min(Math.max(query.pageSize ?? 25, 1), 100);
    const where = this.listWhere(query);
    const pendingWhere = this.listWhere(query, false);
    try {
      const [records, pendingCount] = await this.prisma.$transaction([
        this.prisma.handoffRequest.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { handoffId: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize + 1,
          include: handoffListInclude,
        }),
        this.prisma.handoffRequest.count({
          where: { ...pendingWhere, status: HandoffStatus.PENDING },
        }),
      ]);
      return {
        items: records.slice(0, pageSize),
        page,
        pageSize,
        hasMore: records.length > pageSize,
        pendingCount:
          query.status && query.status !== HandoffStatus.PENDING
            ? 0
            : pendingCount,
      };
    } catch (error) {
      mapPrismaError(error);
    }
  }

  private listWhere(
    query: HandoffListQuery,
    includeStatus = true,
  ): Prisma.HandoffRequestWhereInput {
    const identityWhere = query.userId
      ? query.direction === 'incoming'
        ? { requestedAgentId: query.userId }
        : query.direction === 'outgoing'
          ? { requesterId: query.userId }
          : {
              OR: [
                { requesterId: query.userId },
                { requestedAgentId: query.userId },
              ],
            }
      : {};
    const search = query.search?.trim();

    return {
      ...identityWhere,
      ...(includeStatus && query.status ? { status: query.status } : {}),
      ...(query.ticketId ? { ticketId: query.ticketId } : {}),
      ...(query.requesterId ? { requesterId: query.requesterId } : {}),
      ...(query.requestedAgentId
        ? { requestedAgentId: query.requestedAgentId }
        : {}),
      ...(query.departmentId || search
        ? {
            ticket: {
              ...(query.departmentId
                ? { departmentId: query.departmentId }
                : {}),
              ...(search
                ? {
                    OR: [
                      { ticketCode: { contains: search, mode: 'insensitive' } },
                      { title: { contains: search, mode: 'insensitive' } },
                    ],
                  }
                : {}),
            },
          }
        : {}),
    };
  }

  async findParticipantsForActor(
    userId: string,
  ): Promise<HandoffUserRecord[]> {
    try {
      return await this.prisma.user.findMany({
        where: {
          OR: [
            { handoffsRequested: { some: { requestedAgentId: userId } } },
            { handoffsReceived: { some: { requesterId: userId } } },
          ],
        },
        orderBy: { fullName: 'asc' },
        select: handoffUserSelect,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findPendingDuplicate(
    ticketId: string,
    requesterId: string,
    requestedAgentId: string,
    client: HandoffPersistenceClient,
  ): Promise<HandoffRecord | null> {
    try {
      return await client.handoffRequest.findFirst({
        where: {
          ticketId,
          requesterId,
          requestedAgentId,
          status: HandoffStatus.PENDING,
        },
        include: handoffInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findPendingByTicketId(
    ticketId: string,
    client: HandoffPersistenceClient,
  ): Promise<HandoffRecord[]> {
    try {
      return await client.handoffRequest.findMany({
        where: { ticketId, status: HandoffStatus.PENDING },
        orderBy: { handoffId: 'asc' },
        include: handoffInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findPendingForUserInDepartment(
    userId: string,
    departmentId: string,
    client: HandoffPersistenceClient,
  ): Promise<HandoffRecord[]> {
    try {
      return await client.handoffRequest.findMany({
        where: {
          status: HandoffStatus.PENDING,
          ticket: { departmentId },
          OR: [{ requesterId: userId }, { requestedAgentId: userId }],
        },
        orderBy: { handoffId: 'asc' },
        include: handoffInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findPendingForUser(
    userId: string,
    client: HandoffPersistenceClient,
  ): Promise<HandoffRecord[]> {
    try {
      return await client.handoffRequest.findMany({
        where: {
          status: HandoffStatus.PENDING,
          OR: [{ requesterId: userId }, { requestedAgentId: userId }],
        },
        orderBy: { handoffId: 'asc' },
        include: handoffInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async create(
    data: Prisma.HandoffRequestUncheckedCreateInput,
    client: HandoffPersistenceClient,
  ): Promise<HandoffRecord> {
    try {
      return await client.handoffRequest.create({
        data,
        include: handoffInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async updateStatus(
    handoffId: string,
    status: HandoffStatus,
    resolvedAt: Date,
    client: Prisma.TransactionClient,
  ): Promise<HandoffRecord> {
    try {
      return await client.handoffRequest.update({
        where: { handoffId },
        data: { status, resolvedAt },
        include: handoffInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async lockTicket(
    ticketId: string,
    client: Prisma.TransactionClient,
  ): Promise<Ticket | null> {
    try {
      await client.$queryRaw`
        SELECT "ticket_id"
        FROM "tickets"
        WHERE "ticket_id" = ${ticketId}
        FOR UPDATE
      `;
      return await client.ticket.findUnique({ where: { ticketId } });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findUser(
    userId: string,
    client: HandoffPersistenceClient = this.prisma,
  ): Promise<User | null> {
    try {
      return await client.user.findUnique({ where: { userId } });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findEligibleAgents(
    departmentId: string,
    excludeUserId: string,
  ): Promise<HandoffUserRecord[]> {
    try {
      return await this.prisma.user.findMany({
        where: {
          userId: { not: excludeUserId },
          isActive: true,
          role: { in: [UserRole.Agent, UserRole.Admin] },
          departmentMembers: { some: { departmentId, department: { active: true } } },
        },
        orderBy: { fullName: 'asc' },
        select: handoffUserSelect,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async isActiveMember(
    userId: string,
    departmentId: string,
    client: HandoffPersistenceClient = this.prisma,
  ): Promise<boolean> {
    try {
      const membership = await client.departmentMember.findFirst({
        where: { userId, departmentId, department: { active: true } },
        select: { departmentMemberId: true },
      });
      return Boolean(membership);
    } catch (error) {
      mapPrismaError(error);
    }
  }
}
