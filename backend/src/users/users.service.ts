import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditAction, Prisma, User, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { RealtimeInternalEvent } from '../realtime/realtime-events';
import { SessionService } from '../authentication/sessions/session.service';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { TicketAssignmentReconciliationService } from '../tickets/ticket-assignment-reconciliation.service';
import type { TicketLifecycleResult } from '../tickets/repositories/ticket-lifecycle.repository';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ADMINISTRATION_DEPARTMENT_CODE,
  ADMINISTRATION_DEPARTMENT_ID,
} from '../departments/department.constants';
import {
  AdminUserQueryDto,
  CreateAdminUserDto,
  UpdateRoleDto,
  UpdateStatusDto,
} from '../administration/dto/admin.dto';
import {
  AdminUserRecord,
  UsersRepository,
} from './repositories/users.repository';

export interface CreateUserInput {
  email: string;
  fullName: string;
  phoneNumber?: string | null;
  identityProviderId: string;
  identityProviderUserId: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
    private readonly sessions: SessionService,
    private readonly ticketReconciliation: TicketAssignmentReconciliationService,
    private readonly eventEmitter: EventEmitter2,
    private readonly notifications: NotificationsService,
  ) {}

  findById(userId: string): Promise<User | null> {
    return this.usersRepository.findById(userId);
  }
  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }
  findByIdentity(
    identityProviderId: string,
    identityProviderUserId: string,
  ): Promise<User | null> {
    return this.usersRepository.findByIdentity(
      identityProviderId,
      identityProviderUserId,
    );
  }

  async create(input: CreateUserInput): Promise<User> {
    return this.usersRepository.create({
      userId: randomUUID(),
      email: input.email,
      fullName: input.fullName,
      phoneNumber: input.phoneNumber ?? null,
      role: UserRole.Employee,
      isActive: true,
      hasLogged: true,
      identityProvider: {
        connect: { identityProviderId: input.identityProviderId },
      },
      identityProviderUserId: input.identityProviderUserId,
    });
  }

  async linkIdentity(
    user: User,
    identityProviderId: string,
    identityProviderUserId: string,
  ): Promise<User> {
    if (
      user.identityProviderId === identityProviderId &&
      user.identityProviderUserId === identityProviderUserId &&
      user.hasLogged
    )
      return user;
    return this.usersRepository.update(user.userId, {
      hasLogged: true,
      identityProvider: { connect: { identityProviderId } },
      identityProviderUserId,
    });
  }

  async markAsLoggedIn(user: User): Promise<User> {
    if (user.hasLogged) return user;
    if (!user.identityProviderUserId)
      throw new NotFoundException(
        'User account is not linked to an authenticated identity',
      );
    return this.usersRepository.update(user.userId, { hasLogged: true });
  }

  async findIdentityProviderByCode(code: string) {
    const identityProvider =
      await this.usersRepository.findIdentityProviderByCode(code);
    if (!identityProvider || !identityProvider.active)
      throw new NotFoundException(
        `Identity provider ${code} is not configured or active`,
      );
    return identityProvider;
  }

  async listForAdministration(query: AdminUserQueryDto) {
    const where: Prisma.UserWhereInput = {
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { fullName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.status ? { isActive: query.status === 'active' } : {}),
      ...(query.departmentId
        ? { departmentMembers: { some: { departmentId: query.departmentId } } }
        : {}),
      ...(query.hasLogged !== undefined
        ? { hasLogged: query.hasLogged === 'true' }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.usersRepository.findAdminPage(
        where,
        (query.page - 1) * query.pageSize,
        query.pageSize,
      ),
      this.usersRepository.count(where),
    ]);
    return {
      items: items.map((user) => this.toSafeResponse(user)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async findForAdministration(userId: string) {
    const user = await this.usersRepository.findAdminById(userId);
    if (!user) throw new NotFoundException('User was not found');
    return this.toSafeResponse(user);
  }

  async findForProfile(userId: string) {
    const user = await this.usersRepository.findAdminById(userId);
    if (!user) throw new NotFoundException('User was not found');
    return this.toSafeResponse(user);
  }

  async preProvision(dto: CreateAdminUserDto, actor: AuthenticatedRequestUser) {
    const provider =
      await this.usersRepository.findIdentityProviderByCode(
        'MICROSOFT_ENTRA_ID',
      );
    if (!provider || !provider.active)
      throw new BadRequestException(
        'No active identity provider is configured',
      );
    const user = await this.usersRepository
      .transaction(async (tx) => {
        const created = await this.usersRepository.createPreProvisioned(
          {
            userId: randomUUID(),
            email: dto.email.trim().toLowerCase(),
            fullName: dto.fullName.trim(),
            phoneNumber: dto.phoneNumber?.trim() ?? null,
            role: dto.role,
            isActive: true,
            hasLogged: false,
            identityProvider: {
              connect: { identityProviderId: provider.identityProviderId },
            },
            identityProviderUserId: null,
          },
          tx,
        );
        await this.auditService.append(
          tx,
          actor.userId,
          AuditAction.USER_PREPROVISIONING,
          { userId: created.userId, email: created.email, role: created.role },
        );
        if (created.role === UserRole.Admin) {
          await this.ensureAdministrationMembership(
            created.userId,
            actor.userId,
            tx,
          );
        }
        return created;
      })
      .catch((error) => this.mapConflict(error));
    return this.findForAdministration(user.userId);
  }

  async mapRole(
    userId: string,
    dto: UpdateRoleDto,
    actor: AuthenticatedRequestUser,
  ) {
    let roleChanged = false;
    const reconciledTickets: TicketLifecycleResult[] = [];
    const response = await this.usersRepository.transaction(async (tx) => {
      const user = await this.usersRepository.findByIdForUpdate(userId, tx);
      if (!user) throw new NotFoundException('User was not found');
      if (user.role === dto.role) return this.toSafeResponse(user);
      if (user.role === UserRole.Admin && dto.role !== UserRole.Admin)
        await this.assertNotLastAdmin(userId, tx);
      const updated = await this.usersRepository.updateWithClient(
        userId,
        { role: dto.role },
        tx,
      );
      roleChanged = true;
      if (user.role === UserRole.Admin && dto.role !== UserRole.Admin) {
        reconciledTickets.push(
          ...(await this.removeAdministrationMembership(
            userId,
            actor.userId,
            tx,
          )),
        );
      }
      if (dto.role === UserRole.Employee)
        await this.ticketReconciliation.cancelPendingForUser(
          userId,
          actor.userId,
          tx,
        );
      if (dto.role === UserRole.Employee)
        reconciledTickets.push(
          ...(await this.reconcileMemberships(userId, actor.userId, tx)),
        );
      if (dto.role === UserRole.Admin && user.role !== UserRole.Admin) {
        await this.ensureAdministrationMembership(userId, actor.userId, tx);
      }
      await this.auditService.append(
        tx,
        actor.userId,
        AuditAction.ROLE_MAPPING,
        { userId, beforeRole: user.role, afterRole: dto.role },
      );
      return this.toSafeResponse(updated);
    });
    if (roleChanged) {
      this.ticketReconciliation.publish(reconciledTickets, actor.userId);
      this.notifyAccountChanged(userId);
      return this.findForAdministration(userId);
    }
    return response;
  }

  async setActive(
    userId: string,
    dto: UpdateStatusDto,
    actor: AuthenticatedRequestUser,
  ) {
    const reconciledTickets: TicketLifecycleResult[] = [];
    const result = await this.usersRepository.transaction(async (tx) => {
      const user = await this.usersRepository.findByIdForUpdate(userId, tx);
      if (!user) throw new NotFoundException('User was not found');
      if (user.isActive === dto.active) {
        if (user.role === UserRole.Admin)
          await this.ensureAdministrationMembership(userId, actor.userId, tx);
        return user;
      }
      if (user.role === UserRole.Admin && !dto.active)
        await this.assertNotLastAdmin(userId, tx);
      const updated = await this.usersRepository.updateWithClient(
        userId,
        { isActive: dto.active },
        tx,
      );
      if (!dto.active) {
        await this.ticketReconciliation.cancelPendingForUser(
          userId,
          actor.userId,
          tx,
        );
        reconciledTickets.push(
          ...(await this.reconcileMemberships(userId, actor.userId, tx)),
        );
      }
      if (user.role === UserRole.Admin) {
        await this.ensureAdministrationMembership(userId, actor.userId, tx);
      }
      await this.auditService.append(
        tx,
        actor.userId,
        dto.active
          ? AuditAction.USER_ACTIVATION
          : AuditAction.USER_DEACTIVATION,
        { userId, beforeActive: user.isActive, afterActive: dto.active },
      );
      return updated;
    });
    if (!dto.active) {
      const sessionIds = this.sessions.deleteSessionsForUser(userId);
      this.eventEmitter.emit(RealtimeInternalEvent.SessionInvalidated, {
        userId,
        sessionIds,
        reason: 'DEACTIVATED',
      });
    }
    this.ticketReconciliation.publish(reconciledTickets, actor.userId);
    this.notifyAccountChanged(userId);
    return this.findForAdministration(result.userId);
  }

  async addDepartmentMembership(
    userId: string,
    departmentId: string,
    actor: AuthenticatedRequestUser,
  ) {
    await this.usersRepository.transaction(async (tx) => {
      const user = await this.usersRepository.findByIdForUpdate(userId, tx);
      const department = await this.usersRepository.findDepartment(
        departmentId,
        tx,
      );
      if (!user) throw new NotFoundException('User was not found');
      if (!department) throw new NotFoundException('Department was not found');
      if (
        department.code === ADMINISTRATION_DEPARTMENT_CODE &&
        user.role !== UserRole.Admin
      ) {
        throw new BadRequestException(
          'Only administrators can belong to the Administration department',
        );
      }
      if (user.role === UserRole.Employee) {
        throw new BadRequestException(
          'Only agents and administrators can belong to departments',
        );
      }
      if (!department.active) {
        throw new BadRequestException(
          'Inactive departments cannot accept members',
        );
      }
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
    this.notifyAccountChanged(userId);
    return this.findForAdministration(userId);
  }

  async removeDepartmentMembership(
    userId: string,
    departmentId: string,
    actor: AuthenticatedRequestUser,
  ) {
    const reconciledTickets: TicketLifecycleResult[] = [];
    await this.usersRepository.transaction(async (tx) => {
      const [user, department] = await Promise.all([
        this.usersRepository.findByIdForUpdate(userId, tx),
        this.usersRepository.findDepartment(departmentId, tx),
      ]);
      if (!user) throw new NotFoundException('User was not found');
      if (!department) throw new NotFoundException('Department was not found');
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
      if (!membership)
        throw new NotFoundException('Department membership was not found');
      await this.ticketReconciliation.cancelPendingForUserInDepartment(
        userId,
        departmentId,
        actor.userId,
        tx,
      );
      reconciledTickets.push(
        ...(await this.reconcileDepartmentTickets(
          userId,
          departmentId,
          actor.userId,
          tx,
        )),
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
    });
    this.ticketReconciliation.publish(reconciledTickets, actor.userId);
    this.notifyAccountChanged(userId);
    return this.findForAdministration(userId);
  }

  private async ensureAdministrationMembership(
    userId: string,
    actorId: string,
    tx: Prisma.TransactionClient,
  ) {
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
    if (existing) return existing;
    const membership = await this.usersRepository.upsertMembership(
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
    return membership;
  }

  private async removeAdministrationMembership(
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

  private async reconcileMemberships(
    userId: string,
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<TicketLifecycleResult[]> {
    const memberships = await this.usersRepository.findMemberships(userId, tx);
    if (memberships.length === 0) {
      await this.ticketReconciliation.cancelPendingForUser(userId, actorId, tx);
    }
    for (const membership of memberships)
      await this.ticketReconciliation.cancelPendingForUserInDepartment(
        userId,
        membership.departmentId,
        actorId,
        tx,
      );
    const reconciledTickets: TicketLifecycleResult[] = [];
    for (const membership of memberships)
      reconciledTickets.push(
        ...(await this.reconcileDepartmentTickets(
          userId,
          membership.departmentId,
          actorId,
          tx,
        )),
      );
    if (memberships.length)
      await this.usersRepository.deleteMemberships(userId, tx);
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

  private async assertNotLastAdmin(
    userId: string,
    client: Prisma.TransactionClient,
  ) {
    if (
      (await this.usersRepository.countActiveAdminsExcept(userId, client)) === 0
    )
      throw new ConflictException(
        'The last active administrator cannot be removed',
      );
  }

  private toSafeResponse(user: User | AdminUserRecord) {
    const departmentMembers =
      'departmentMembers' in user ? user.departmentMembers : [];
    return {
      userId: user.userId,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      role: user.role,
      isActive: user.isActive,
      hasLogged: user.hasLogged,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      departments: departmentMembers.map((membership) => membership.department),
    };
  }

  private notifyAccountChanged(userId: string): void {
    this.notifications.notify({
      type: 'ACCOUNT_UPDATED',
      message:
        'Your account configuration or role/department has been updated by an administrator. You must refresh the page to continue.',
      recipientUserIds: [userId],
      blocking: true,
    });
  }

  private mapConflict(error: unknown): never {
    if (
      error instanceof ConflictException ||
      error instanceof NotFoundException ||
      error instanceof BadRequestException
    )
      throw error;
    if ((error as { code?: string })?.code === 'P2002')
      throw new ConflictException(
        'A record with the same unique value already exists',
      );
    throw error;
  }
}
