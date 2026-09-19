import { User } from '@prisma/client';
import type { AdminUserRecord } from './repositories/users.repository';

export interface SafeUserResponse {
  userId: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  role: User['role'];
  isActive: boolean;
  hasLogged: boolean;
  createdAt: Date;
  updatedAt: Date;
  departments: Array<
    AdminUserRecord['departmentMembers'][number]['department']
  >;
}

export class UserResponseMapper {
  toSafeResponse(user: User | AdminUserRecord): SafeUserResponse {
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
}
