import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma, UserRole } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { AuditService } from '../audit/audit.service';
import {
  ADMINISTRATION_DEPARTMENT_CODE,
  ADMINISTRATION_DEPARTMENT_ID,
} from '../departments/department.constants';
import { TicketAssignmentReconciliationService } from '../tickets/ticket-assignment-reconciliation.service';
import type { TicketLifecycleResult } from '../tickets/repositories/ticket-lifecycle.repository';
import { UsersRepository } from './repositories/users.repository';

@Injectable()
export class UserMembershipService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
    private readonly ticketReconciliation: TicketAssignmentReconciliationService,
  ) {}

  async addDepartmentMembership(
    userId: string,
    departmentId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<void> {
    await this.usersRepository.transaction(async (tx) => {
      const user = await this.usersRepository.findByIdForUpdate(userId, tx);
      const department = await this.usersRepository.findDepartment(
        departmentId,
        tx,
      );
      if (!user) throw new NotFoundException('User was not found');
      if (!department) throw new NotFoundException('Department was not found');
      this.assertCanJoinDepartment(
        user.role,
        department.code,
        department.active,
      );

      await this.usersRepository.upsertMembership(userId, departmentId, tx);
      await this.auditService.append(
        tx,
        actor.userId,
        AuditAction.DEPARTMENT_MAPPING,
        {
          userId,
          departmentId,
          mapping: 'ADDED',
        },
      );
    });
  }

  async removeDepartmentMembership(
    userId: string,
    departmentId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketLifecycleResult[]> {
    const reconciledTickets = await this.usersRepository.transaction(
      async (tx) => {
        const [user, department] = await Promise.all([
          this.usersRepository.findByIdForUpdate(userId, tx),
          this.usersRepository.findDepartment(departmentId, tx),
        ]);
        if (!user) throw new NotFoundException('User was not found');
        if (!department)
          throw new NotFoundException('Department was not found');
        if (
          department.code === ADMINISTRATION_DEPARTMENT_CODE &&
          user.role === UserRole.Admin
        ) {
          throw new BadRequestException(
            'Administrators must remain members of the Administration department',
          );
        }

        const membership = await this.usersRepository.findMembership(
          userId,
          departmentId,
          tx,
        );
        if (!membership) {
          throw new NotFoundException('Department membership was not found');
        }

        await this.ticketReconciliation.cancelPendingForUserInDepartment(
          userId,
          departmentId,
          actor.userId,
          tx,
        );
        const mutations = await this.reconcileDepartmentTickets(
          userId,
          departmentId,
          actor.userId,
          tx,
        );
        await this.usersRepository.deleteMembership(userId, departmentId, tx);
        await this.auditService.append(
          tx,
          actor.userId,
          AuditAction.DEPARTMENT_MAPPING,
          {
            userId,
            departmentId,
            mapping: 'REMOVED',
          },
        );
        return mutations;
      },
    );

    this.publish(reconciledTickets, actor.userId);
    return reconciledTickets;
  }

  async ensureAdministrationMembership(
    userId: string,
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const department = await this.usersRepository.findDepartment(
      ADMINISTRATION_DEPARTMENT_ID,
      tx,
    );
    if (
      !department ||
      department.code !== ADMINISTRATION_DEPARTMENT_CODE ||
      !department.active
    ) {
      throw new BadRequestException(
        'The Administration department is not configured or active',
      );
    }

    const existing = await this.usersRepository.findMembership(
      userId,
      ADMINISTRATION_DEPARTMENT_ID,
      tx,
    );
    if (existing) return;

    await this.usersRepository.upsertMembership(
      userId,
      ADMINISTRATION_DEPARTMENT_ID,
      tx,
    );
    await this.auditService.append(
      tx,
      actorId,
      AuditAction.DEPARTMENT_MAPPING,
      {
        userId,
        departmentId: ADMINISTRATION_DEPARTMENT_ID,
        mapping: 'ADDED',
        reason: 'ADMIN_ROLE',
      },
    );
  }

  async removeAdministrationMembership(
    userId: string,
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<TicketLifecycleResult[]> {
    const membership = await this.usersRepository.findMembership(
      userId,
      ADMINISTRATION_DEPARTMENT_ID,
      tx,
    );
    if (!membership) return [];

    await this.ticketReconciliation.cancelPendingForUserInDepartment(
      userId,
      ADMINISTRATION_DEPARTMENT_ID,
      actorId,
      tx,
    );
    const reconciledTickets = await this.reconcileDepartmentTickets(
      userId,
      ADMINISTRATION_DEPARTMENT_ID,
      actorId,
      tx,
    );
    await this.usersRepository.deleteMembership(
      userId,
      ADMINISTRATION_DEPARTMENT_ID,
      tx,
    );
    await this.auditService.append(
      tx,
      actorId,
      AuditAction.DEPARTMENT_MAPPING,
      {
        userId,
        departmentId: ADMINISTRATION_DEPARTMENT_ID,
        mapping: 'REMOVED',
        reason: 'ADMIN_ROLE',
      },
    );
    return reconciledTickets;
  }

  async reconcileUserEligibility(
    userId: string,
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<TicketLifecycleResult[]> {
    await this.ticketReconciliation.cancelPendingForUser(userId, actorId, tx);
    return this.reconcileMemberships(userId, actorId, tx);
  }

  async reconcileUserDeactivation(
    userId: string,
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<TicketLifecycleResult[]> {
    const cancelledTickets =
      await this.ticketReconciliation.cancelTicketsForDeactivatedUser(
        userId,
        actorId,
        tx,
      );
    const reconciledTickets = await this.reconcileUserEligibility(
      userId,
      actorId,
      tx,
    );
    return [...cancelledTickets, ...reconciledTickets];
  }

  publish(mutations: TicketLifecycleResult[], actorId: string): void {
    this.ticketReconciliation.publish(mutations, actorId);
  }

  private async reconcileMemberships(
    userId: string,
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<TicketLifecycleResult[]> {
    const memberships = await this.usersRepository.findMemberships(userId, tx);
    const reconciledTickets: TicketLifecycleResult[] = [];

    for (const membership of memberships) {
      await this.ticketReconciliation.cancelPendingForUserInDepartment(
        userId,
        membership.departmentId,
        actorId,
        tx,
      );
      reconciledTickets.push(
        ...(await this.reconcileDepartmentTickets(
          userId,
          membership.departmentId,
          actorId,
          tx,
        )),
      );
    }

    if (memberships.length) {
      await this.usersRepository.deleteMemberships(userId, tx);
    }
    return reconciledTickets;
  }

  private async reconcileDepartmentTickets(
    userId: string,
    departmentId: string,
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<TicketLifecycleResult[]> {
    return this.ticketReconciliation.reconcileDepartmentClaims(
      userId,
      departmentId,
      actorId,
      tx,
    );
  }

  private assertCanJoinDepartment(
    role: UserRole,
    departmentCode: string,
    departmentActive: boolean,
  ): void {
    if (
      departmentCode === ADMINISTRATION_DEPARTMENT_CODE &&
      role !== UserRole.Admin
    ) {
      throw new BadRequestException(
        'Only administrators can belong to the Administration department',
      );
    }
    if (role === UserRole.Employee) {
      throw new BadRequestException(
        'Only agents and administrators can belong to departments',
      );
    }
    if (!departmentActive) {
      throw new BadRequestException(
        'Inactive departments cannot accept members',
      );
    }
  }
}
