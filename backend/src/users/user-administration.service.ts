import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditAction, Prisma, UserRole } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { AuditService } from '../audit/audit.service';
import {
  AdminUserQueryDto,
  CreateAdminUserDto,
  UpdateRoleDto,
  UpdateStatusDto,
} from '../administration/dto/admin.dto';
import { NotificationsService } from '../notifications/notifications.service';
import type { TicketLifecycleResult } from '../tickets/repositories/ticket-lifecycle.repository';
import { UserInternalEvent } from './user-events';
import { UserMembershipService } from './user-membership.service';
import { UsersRepository } from './repositories/users.repository';
import { SafeUserResponse, UserResponseMapper } from './user-response.mapper';
import { randomUUID } from 'crypto';

@Injectable()
export class UserAdministrationService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
    private readonly userMembershipService: UserMembershipService,
    private readonly userResponseMapper: UserResponseMapper,
    private readonly eventEmitter: EventEmitter2,
    private readonly notifications: NotificationsService,
  ) {}

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
      items: items.map((user) => this.userResponseMapper.toSafeResponse(user)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async findForAdministration(userId: string): Promise<SafeUserResponse> {
    const user = await this.usersRepository.findAdminById(userId);
    if (!user) throw new NotFoundException('User was not found');
    return this.userResponseMapper.toSafeResponse(user);
  }

  async preProvision(
    dto: CreateAdminUserDto,
    actor: AuthenticatedRequestUser,
  ): Promise<SafeUserResponse> {
    const provider =
      await this.usersRepository.findIdentityProviderByCode(
        'MICROSOFT_ENTRA_ID',
      );
    if (!provider || !provider.active) {
      throw new BadRequestException(
        'No active identity provider is configured',
      );
    }

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
          await this.userMembershipService.ensureAdministrationMembership(
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
  ): Promise<SafeUserResponse> {
    let roleChanged = false;
    const reconciledTickets: TicketLifecycleResult[] = [];
    const response = await this.usersRepository.transaction(async (tx) => {
      const user = await this.usersRepository.findByIdForUpdate(userId, tx);
      if (!user) throw new NotFoundException('User was not found');
      if (user.role === dto.role) {
        return this.userResponseMapper.toSafeResponse(user);
      }
      if (user.role === UserRole.Admin && dto.role !== UserRole.Admin) {
        await this.assertNotLastAdmin(userId, tx);
      }

      const updated = await this.usersRepository.updateWithClient(
        userId,
        { role: dto.role },
        tx,
      );
      roleChanged = true;

      if (user.role === UserRole.Admin && dto.role !== UserRole.Admin) {
        reconciledTickets.push(
          ...(await this.userMembershipService.removeAdministrationMembership(
            userId,
            actor.userId,
            tx,
          )),
        );
      }
      if (dto.role === UserRole.Employee) {
        reconciledTickets.push(
          ...(await this.userMembershipService.reconcileUserEligibility(
            userId,
            actor.userId,
            tx,
          )),
        );
      }
      if (dto.role === UserRole.Admin && user.role !== UserRole.Admin) {
        await this.userMembershipService.ensureAdministrationMembership(
          userId,
          actor.userId,
          tx,
        );
      }

      await this.auditService.append(
        tx,
        actor.userId,
        AuditAction.ROLE_MAPPING,
        { userId, beforeRole: user.role, afterRole: dto.role },
      );
      return this.userResponseMapper.toSafeResponse(updated);
    });

    if (roleChanged) {
      this.userMembershipService.publish(reconciledTickets, actor.userId);
      this.notifyAccountChanged(userId);
      return this.findForAdministration(userId);
    }
    return response;
  }

  async setActive(
    userId: string,
    dto: UpdateStatusDto,
    actor: AuthenticatedRequestUser,
  ): Promise<SafeUserResponse> {
    const reconciledTickets: TicketLifecycleResult[] = [];
    const result = await this.usersRepository.transaction(async (tx) => {
      const user = await this.usersRepository.findByIdForUpdate(userId, tx);
      if (!user) throw new NotFoundException('User was not found');
      if (user.isActive === dto.active) {
        if (user.role === UserRole.Admin) {
          await this.userMembershipService.ensureAdministrationMembership(
            userId,
            actor.userId,
            tx,
          );
        }
        return user;
      }
      if (user.role === UserRole.Admin && !dto.active) {
        await this.assertNotLastAdmin(userId, tx);
      }

      const updated = await this.usersRepository.updateWithClient(
        userId,
        { isActive: dto.active },
        tx,
      );
      if (!dto.active) {
        reconciledTickets.push(
          ...(await this.userMembershipService.reconcileUserEligibility(
            userId,
            actor.userId,
            tx,
          )),
        );
      }
      if (user.role === UserRole.Admin) {
        await this.userMembershipService.ensureAdministrationMembership(
          userId,
          actor.userId,
          tx,
        );
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
      this.eventEmitter.emit(UserInternalEvent.Deactivated, {
        userId: result.userId,
      });
    }
    this.userMembershipService.publish(reconciledTickets, actor.userId);
    this.notifyAccountChanged(userId);
    return this.findForAdministration(result.userId);
  }

  async addDepartmentMembership(
    userId: string,
    departmentId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<SafeUserResponse> {
    await this.userMembershipService.addDepartmentMembership(
      userId,
      departmentId,
      actor,
    );
    this.notifyAccountChanged(userId);
    return this.findForAdministration(userId);
  }

  async removeDepartmentMembership(
    userId: string,
    departmentId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<SafeUserResponse> {
    await this.userMembershipService.removeDepartmentMembership(
      userId,
      departmentId,
      actor,
    );
    this.notifyAccountChanged(userId);
    return this.findForAdministration(userId);
  }

  private async assertNotLastAdmin(
    userId: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    if (
      (await this.usersRepository.countActiveAdminsExcept(userId, client)) === 0
    ) {
      throw new ConflictException(
        'The last active administrator cannot be removed',
      );
    }
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
    ) {
      throw error;
    }
    if ((error as { code?: string })?.code === 'P2002') {
      throw new ConflictException(
        'A record with the same unique value already exists',
      );
    }
    throw error;
  }
}
