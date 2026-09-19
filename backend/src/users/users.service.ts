import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import {
  AdminUserQueryDto,
  CreateAdminUserDto,
  UpdateRoleDto,
  UpdateStatusDto,
} from '../administration/dto/admin.dto';
import type { SafeUserResponse } from './user-response.mapper';
import { CreateUserInput, UserAccountService } from './user-account.service';
import { UserAdministrationService } from './user-administration.service';

export type { CreateUserInput } from './user-account.service';
export type { SafeUserResponse } from './user-response.mapper';

/** Stable user application façade for controllers and authentication. */
@Injectable()
export class UsersService {
  constructor(
    private readonly userAccountService: UserAccountService,
    private readonly userAdministrationService: UserAdministrationService,
  ) {}

  findById(userId: string): Promise<User | null> {
    return this.userAccountService.findById(userId);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userAccountService.findByEmail(email);
  }

  findByIdentity(
    identityProviderId: string,
    identityProviderUserId: string,
  ): Promise<User | null> {
    return this.userAccountService.findByIdentity(
      identityProviderId,
      identityProviderUserId,
    );
  }

  create(input: CreateUserInput): Promise<User> {
    return this.userAccountService.create(input);
  }

  linkIdentity(
    user: User,
    identityProviderId: string,
    identityProviderUserId: string,
  ): Promise<User> {
    return this.userAccountService.linkIdentity(
      user,
      identityProviderId,
      identityProviderUserId,
    );
  }

  markAsLoggedIn(user: User): Promise<User> {
    return this.userAccountService.markAsLoggedIn(user);
  }

  findIdentityProviderByCode(code: string) {
    return this.userAccountService.findIdentityProviderByCode(code);
  }

  findForProfile(userId: string): Promise<SafeUserResponse> {
    return this.userAccountService.findForProfile(userId);
  }

  listForAdministration(query: AdminUserQueryDto) {
    return this.userAdministrationService.listForAdministration(query);
  }

  findForAdministration(userId: string): Promise<SafeUserResponse> {
    return this.userAdministrationService.findForAdministration(userId);
  }

  preProvision(
    dto: CreateAdminUserDto,
    actor: AuthenticatedRequestUser,
  ): Promise<SafeUserResponse> {
    return this.userAdministrationService.preProvision(dto, actor);
  }

  mapRole(
    userId: string,
    dto: UpdateRoleDto,
    actor: AuthenticatedRequestUser,
  ): Promise<SafeUserResponse> {
    return this.userAdministrationService.mapRole(userId, dto, actor);
  }

  setActive(
    userId: string,
    dto: UpdateStatusDto,
    actor: AuthenticatedRequestUser,
  ): Promise<SafeUserResponse> {
    return this.userAdministrationService.setActive(userId, dto, actor);
  }

  addDepartmentMembership(
    userId: string,
    departmentId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<SafeUserResponse> {
    return this.userAdministrationService.addDepartmentMembership(
      userId,
      departmentId,
      actor,
    );
  }

  removeDepartmentMembership(
    userId: string,
    departmentId: string,
    actor: AuthenticatedRequestUser,
  ): Promise<SafeUserResponse> {
    return this.userAdministrationService.removeDepartmentMembership(
      userId,
      departmentId,
      actor,
    );
  }
}
