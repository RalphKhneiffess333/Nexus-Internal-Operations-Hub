import { User } from '@prisma/client';
import type {
  AdminUserListRecord,
  AdminUserRecord,
} from './repositories/users.repository';

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

export type SafeUserListResponse = Pick<
  SafeUserResponse,
  'userId' | 'email' | 'fullName' | 'role' | 'isActive' | 'hasLogged' | 'departments'
>;

export class UserResponseMapper {
  toListResponse(user: AdminUserListRecord): SafeUserListResponse {
    return {
      userId: user.userId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      hasLogged: user.hasLogged,
      departments: user.departmentMembers.map(
        (membership) => membership.department,
      ),
    };
  }

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
