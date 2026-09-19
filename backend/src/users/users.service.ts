import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuditAction,
  Prisma,
  TicketEventAction,
  TicketStatus,
  User,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { RealtimeInternalEvent } from '../realtime/realtime-events';
import { SessionService } from '../authentication/sessions/session.service';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { PrismaService } from '../database/prisma.service';
import { HandoffsService } from '../tickets/handoffs/handoffs.service';
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
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(forwardRef(() => SessionService))
    private readonly sessions: SessionService,
    @Inject(forwardRef(() => HandoffsService))
    private readonly handoffsService: HandoffsService,
    private readonly eventEmitter: EventEmitter2,
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
    const user = await this.prisma
      .$transaction(async (tx) => {
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
        return created;
      })
      .catch((error) => this.mapConflict(error));
    return this.toSafeResponse(user);
  }

  async mapRole(
    userId: string,
    dto: UpdateRoleDto,
    actor: AuthenticatedRequestUser,
  ) {
    let roleChanged = false;
    const response = await this.prisma.$transaction(async (tx) => {
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
      if (dto.role === UserRole.Employee)
        await this.handoffsService.cancelPendingForUser(
          userId,
          actor.userId,
          tx,
        );
      if (dto.role === UserRole.Employee)
        await this.reconcileMemberships(userId, actor.userId, tx);
      await this.auditService.append(
        tx,
        actor.userId,
        AuditAction.ROLE_MAPPING,
        { userId, beforeRole: user.role, afterRole: dto.role },
      );
      return this.toSafeResponse(updated);
    });
    if (roleChanged) {
      this.eventEmitter.emit(RealtimeInternalEvent.SessionInvalidated, {
        userId,
        reason: 'ROLE_CHANGED',
      });
    }
    return response;
  }

  async setActive(
    userId: string,
    dto: UpdateStatusDto,
    actor: AuthenticatedRequestUser,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await this.usersRepository.findByIdForUpdate(userId, tx);
      if (!user) throw new NotFoundException('User was not found');
      if (user.isActive === dto.active) return user;
      if (user.role === UserRole.Admin && !dto.active)
        await this.assertNotLastAdmin(userId, tx);
      const updated = await this.usersRepository.updateWithClient(
        userId,
        { isActive: dto.active },
        tx,
      );
      if (!dto.active) {
        await this.handoffsService.cancelPendingForUser(
          userId,
          actor.userId,
          tx,
        );
        await this.reconcileMemberships(userId, actor.userId, tx);
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
    return this.findForAdministration(result.userId);
  }

  async addDepartmentMembership(
    userId: string,
    departmentId: string,
    actor: AuthenticatedRequestUser,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const user = await this.usersRepository.findByIdForUpdate(userId, tx);
      const department = await tx.department.findUnique({
        where: { departmentId },
      });
      if (!user) throw new NotFoundException('User was not found');
      if (!department) throw new NotFoundException('Department was not found');
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
    return this.findForAdministration(userId);
  }

  async removeDepartmentMembership(
    userId: string,
    departmentId: string,
    actor: AuthenticatedRequestUser,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const membership = await this.usersRepository.findMembership(
        userId,
        departmentId,
        tx,
      );
      if (!membership)
        throw new NotFoundException('Department membership was not found');
      await this.handoffsService.cancelPendingForUserInDepartment(
        userId,
        departmentId,
        actor.userId,
        tx,
      );
      await this.reconcileDepartmentTickets(
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
    });
    return this.findForAdministration(userId);
  }

  private async reconcileMemberships(
    userId: string,
    actorId: string,
    tx: Prisma.TransactionClient,
  ) {
    const memberships = await tx.departmentMember.findMany({
      where: { userId },
    });
    if (memberships.length === 0) {
      await this.handoffsService.cancelPendingForUser(userId, actorId, tx);
    }
    for (const membership of memberships)
      await this.handoffsService.cancelPendingForUserInDepartment(
        userId,
        membership.departmentId,
        actorId,
        tx,
      );
    for (const membership of memberships)
      await this.reconcileDepartmentTickets(
        userId,
        membership.departmentId,
        actorId,
        tx,
      );
    if (memberships.length)
      await tx.departmentMember.deleteMany({ where: { userId } });
  }

  private async reconcileDepartmentTickets(
    userId: string,
    departmentId: string,
    actorId: string,
    tx: Prisma.TransactionClient,
  ) {
    const tickets = await tx.ticket.findMany({
      where: {
        departmentId,
        agentId: userId,
        active: true,
        status: TicketStatus.CLAIMED,
      },
    });
    for (const ticket of tickets) {
      await this.handoffsService.cancelPendingForTicket(
        ticket.ticketId,
        actorId,
        'DEPARTMENT_MEMBERSHIP_CHANGED',
        tx,
      );
      const current = await tx.ticket.findUnique({
        where: { ticketId: ticket.ticketId },
      });
      if (
        !current ||
        !current.active ||
        current.status !== TicketStatus.CLAIMED ||
        current.agentId !== userId
      ) {
        continue;
      }
      const now = new Date();
      await tx.ticket.update({
        where: { ticketId: current.ticketId },
        data: {
          status: TicketStatus.CLOSED,
          agentId: null,
          completionNotes: 'This agent was removed from the department.',
          closedAt: now,
          updatedAt: now,
        },
      });
      await tx.ticketEvent.create({
        data: {
          ticketEventId: randomUUID(),
          ticketId: ticket.ticketId,
          userId: actorId,
          action: TicketEventAction.CLOSE,
          details: {
            agentId: userId,
            completionNotes: 'This agent was removed from the department.',
          },
          createdAt: now,
          updatedAt: now,
        },
      });
    }
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
