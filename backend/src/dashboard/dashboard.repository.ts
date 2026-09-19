import { Injectable } from '@nestjs/common';
import { Prisma, TicketStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

const dashboardTicketSelect = {
  ticketId: true,
  ticketCode: true,
  title: true,
  priority: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  department: {
    select: {
      departmentId: true,
      code: true,
      name: true,
    },
  },
  submitter: {
    select: {
      userId: true,
      fullName: true,
      email: true,
    },
  },
  agent: {
    select: {
      userId: true,
      fullName: true,
      email: true,
    },
  },
} satisfies Prisma.TicketSelect;

export type DashboardTicketRecord = Prisma.TicketGetPayload<{
  select: typeof dashboardTicketSelect;
}>;

export interface DashboardDepartmentRecord {
  departmentId: string;
  code: string;
  name: string;
  unclaimedCount: number;
}

export interface DashboardActivityRecord {
  source: 'audit' | 'ticket';
  action: string;
  createdAt: Date;
  actor: { userId: string; fullName: string; email: string } | null;
  ticket: { ticketId: string; ticketCode: string; title: string } | null;
}

export type TicketStatusCounts = Record<TicketStatus, number>;

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDepartmentsForUser(
    userId: string,
  ): Promise<DashboardDepartmentRecord[]> {
    const departments = await this.prisma.department.findMany({
      where: {
        active: true,
        members: { some: { userId } },
      },
      select: {
        departmentId: true,
        code: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    return this.withUnclaimedCounts(departments);
  }

  async findDepartmentsForAdmin(): Promise<DashboardDepartmentRecord[]> {
    const departments = await this.prisma.department.findMany({
      where: { active: true },
      select: {
        departmentId: true,
        code: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    return this.withUnclaimedCounts(departments);
  }

  async countTicketsByStatus(
    where: Prisma.TicketWhereInput,
  ): Promise<TicketStatusCounts> {
    const grouped = await this.prisma.ticket.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
    const counts = Object.values(TicketStatus).reduce((result, status) => {
      result[status] = 0;
      return result;
    }, {} as TicketStatusCounts);

    grouped.forEach((row) => {
      counts[row.status] = row._count._all;
    });
    return counts;
  }

  async findRecentTickets(
    where: Prisma.TicketWhereInput,
    take = 5,
  ): Promise<DashboardTicketRecord[]> {
    return this.prisma.ticket.findMany({
      where,
      select: dashboardTicketSelect,
      orderBy: [{ updatedAt: 'desc' }, { ticketId: 'desc' }],
      take,
    });
  }

  async countPendingIncomingHandoffs(userId: string): Promise<number> {
    return this.prisma.handoffRequest.count({
      where: { requestedAgentId: userId, status: 'PENDING' },
    });
  }

  async countPendingOutgoingHandoffs(userId: string): Promise<number> {
    return this.prisma.handoffRequest.count({
      where: { requesterId: userId, status: 'PENDING' },
    });
  }

  async countUsers(): Promise<{
    total: number;
    active: number;
    inactive: number;
    pendingLogin: number;
  }> {
    const [total, active, inactive, pendingLogin] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isActive: false } }),
      this.prisma.user.count({ where: { hasLogged: false } }),
    ]);
    return { total, active, inactive, pendingLogin };
  }

  async countActiveDepartments(): Promise<number> {
    return this.prisma.department.count({ where: { active: true } });
  }

  async findRecentActivity(take = 6): Promise<DashboardActivityRecord[]> {
    const [auditLogs, ticketEvents] = await Promise.all([
      this.prisma.auditLog.findMany({
        select: {
          action: true,
          createdAt: true,
          actor: { select: { userId: true, fullName: true, email: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { auditLogId: 'desc' }],
        take,
      }),
      this.prisma.ticketEvent.findMany({
        select: {
          action: true,
          createdAt: true,
          user: { select: { userId: true, fullName: true, email: true } },
          ticket: { select: { ticketId: true, ticketCode: true, title: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { ticketEventId: 'desc' }],
        take,
      }),
    ]);

    return [
      ...auditLogs.map((log) => ({
        source: 'audit' as const,
        action: log.action,
        createdAt: log.createdAt,
        actor: log.actor,
        ticket: null,
      })),
      ...ticketEvents.map((event) => ({
        source: 'ticket' as const,
        action: event.action,
        createdAt: event.createdAt,
        actor: event.user,
        ticket: event.ticket,
      })),
    ]
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
      .slice(0, take);
  }

  private async withUnclaimedCounts(
    departments: Array<
      Pick<DashboardDepartmentRecord, 'departmentId' | 'code' | 'name'>
    >,
  ): Promise<DashboardDepartmentRecord[]> {
    const departmentIds = departments.map(
      (department) => department.departmentId,
    );
    if (departmentIds.length === 0) return [];

    const grouped = await this.prisma.ticket.groupBy({
      by: ['departmentId'],
      where: {
        active: true,
        agentId: null,
        status: { in: [TicketStatus.OPEN, TicketStatus.REOPENED] },
        departmentId: { in: departmentIds },
      },
      _count: { _all: true },
    });
    const counts = new Map(
      grouped.map((row) => [row.departmentId, row._count._all]),
    );

    return departments.map((department) => ({
      ...department,
      unclaimedCount: counts.get(department.departmentId) ?? 0,
    }));
  }
}
