import { Injectable } from '@nestjs/common';
import { Prisma, TicketStatus, UserRole } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import {
  DashboardRepository,
  type DashboardTicketRecord,
} from './dashboard.repository';

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  async getSummary(actor: AuthenticatedRequestUser) {
    const isAdmin = actor.role === UserRole.Admin;
    const canWorkTickets = actor.role === UserRole.Agent || isAdmin;
    const departments = isAdmin
      ? await this.dashboardRepository.findDepartmentsForAdmin()
      : await this.dashboardRepository.findDepartmentsForUser(actor.userId);
    const departmentIds = departments.map(
      (department) => department.departmentId,
    );
    const activeWhere: Prisma.TicketWhereInput = { active: true };
    const myTicketWhere: Prisma.TicketWhereInput = {
      ...activeWhere,
      submittedBy: actor.userId,
    };
    const assignedTicketWhere: Prisma.TicketWhereInput = {
      ...activeWhere,
      agentId: actor.userId,
    };
    const myAttentionWhere: Prisma.TicketWhereInput = {
      ...myTicketWhere,
      status: TicketStatus.REOPENED,
    };
    const poolTicketWhere: Prisma.TicketWhereInput = {
      ...activeWhere,
      agentId: null,
      status: { in: [TicketStatus.OPEN, TicketStatus.REOPENED] },
      ...(isAdmin ? {} : { departmentId: { in: departmentIds } }),
    };

    const [
      myTicketCounts,
      myRecentTickets,
      myAttentionTickets,
      activeTicketCounts,
    ] =
      await Promise.all([
        this.dashboardRepository.countTicketsByStatus(myTicketWhere),
        this.dashboardRepository.findRecentTickets(myTicketWhere),
        this.dashboardRepository.findRecentTickets(myAttentionWhere, 3),
        isAdmin
          ? this.dashboardRepository.countTicketsByStatus(activeWhere)
          : Promise.resolve(null),
      ]);

    const summary = {
      role: actor.role,
      user: { fullName: actor.fullName, email: actor.email },
      departments,
      myTickets: {
        counts: myTicketCounts,
        recent: myRecentTickets.map((ticket) => this.toTicketSummary(ticket)),
        attention: myAttentionTickets.map((ticket) =>
          this.toTicketSummary(ticket),
        ),
      },
    };

    if (!canWorkTickets) return summary;

    const [
      assignedCounts,
      assignedRecent,
      poolCounts,
      poolRecent,
      poolAttention,
      incoming,
      outgoing,
    ] = await Promise.all([
      this.dashboardRepository.countTicketsByStatus(assignedTicketWhere),
      this.dashboardRepository.findRecentTickets(assignedTicketWhere),
      this.dashboardRepository.countTicketsByStatus(poolTicketWhere),
      this.dashboardRepository.findRecentTickets(poolTicketWhere),
      this.dashboardRepository.findRecentTickets(
        { ...poolTicketWhere, priority: 'HIGH' },
        3,
      ),
      this.dashboardRepository.countPendingIncomingHandoffs(actor.userId),
      this.dashboardRepository.countPendingOutgoingHandoffs(actor.userId),
    ]);

    const workSummary = {
      ...summary,
      work: {
        assigned: {
          counts: assignedCounts,
          recent: assignedRecent.map((ticket) => this.toTicketSummary(ticket)),
        },
        pool: {
          counts: poolCounts,
          recent: poolRecent.map((ticket) => this.toTicketSummary(ticket)),
        },
        handoffs: { incomingPending: incoming, outgoingPending: outgoing },
      },
    };

    if (!isAdmin) return workSummary;

    const [users, activeDepartments, recentActivity] = await Promise.all([
      this.dashboardRepository.countUsers(),
      this.dashboardRepository.countActiveDepartments(),
      this.dashboardRepository.findRecentActivity(),
    ]);

    return {
      ...workSummary,
      administration: {
        users,
        activeDepartments,
        tickets: activeTicketCounts,
        recentActivity,
      },
    };
  }

  private toTicketSummary(ticket: DashboardTicketRecord) {
    return {
      ticketId: ticket.ticketId,
      ticketCode: ticket.ticketCode,
      title: ticket.title,
      priority: ticket.priority,
      status: ticket.status,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      department: ticket.department,
      submittedBy: ticket.submitter,
      agent: ticket.agent,
    };
  }
}
