import { Injectable } from '@nestjs/common';
import { Prisma, TicketStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditRepository } from '../audit/audit.repository';
import type { ActivityListRecord } from '../audit/audit.repository';

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
    },
  },
  agent: {
    select: {
      userId: true,
      fullName: true,
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
  actor: { userId: string; fullName: string } | null;
  ticket: { ticketId: string; ticketCode: string; title: string } | null;
}

export type TicketStatusCounts = Record<TicketStatus, number>;

@Injectable()
export class DashboardRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditRepository: AuditRepository,
  ) {}

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
    const activity = await this.auditRepository.listActivity(
      'all',
      undefined,
      undefined,
      0,
      take,
    );
    return activity.map((entry) => this.toDashboardActivity(entry));
  }

  private toDashboardActivity(
    entry: ActivityListRecord,
  ): DashboardActivityRecord {
    return {
      source: entry.source,
      action: entry.action,
      createdAt: entry.createdAt,
      actor: entry.actor,
      ticket: entry.ticket,
    };
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
