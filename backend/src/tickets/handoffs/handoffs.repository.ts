import { Injectable } from '@nestjs/common';
import { HandoffStatus, Prisma, Ticket, User, UserRole } from '@prisma/client';
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

export type HandoffRecord = Prisma.HandoffRequestGetPayload<{
  include: typeof handoffInclude;
}>;

export type HandoffUserRecord = Prisma.UserGetPayload<{
  select: typeof handoffUserSelect;
}>;

@Injectable()
export class HandoffsRepository {
  constructor(private readonly prisma: PrismaService) {}

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

  async findByTicketId(
    ticketId: string,
    status?: HandoffStatus,
  ): Promise<HandoffRecord[]> {
    try {
      return await this.prisma.handoffRequest.findMany({
        where: { ticketId, ...(status ? { status } : {}) },
        orderBy: [{ createdAt: 'desc' }, { handoffId: 'desc' }],
        include: handoffInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findForActor(
    userId: string,
    direction: 'incoming' | 'outgoing' | 'all',
    query: { status?: HandoffStatus; ticketId?: string } = {},
  ): Promise<HandoffRecord[]> {
    const identityWhere =
      direction === 'incoming'
        ? { requestedAgentId: userId }
        : direction === 'outgoing'
          ? { requesterId: userId }
          : { OR: [{ requesterId: userId }, { requestedAgentId: userId }] };
    try {
      return await this.prisma.handoffRequest.findMany({
        where: {
          ...identityWhere,
          ...(query.status ? { status: query.status } : {}),
          ...(query.ticketId ? { ticketId: query.ticketId } : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { handoffId: 'desc' }],
        include: handoffInclude,
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
    client: HandoffPersistenceClient,
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
    client: HandoffPersistenceClient,
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
