import type { Request } from 'express';
import type { User, UserRole } from '@prisma/client';

export interface AuthenticatedRequestUser {
  userId: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  role: UserRole;
  isActive: boolean;
  hasLogged: boolean;
  identityProviderId: string;
  identityProviderUserId: string | null;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedRequestUser | null;
  sessionId: string | null;
}

export function toAuthenticatedRequestUser(
  user: User,
): AuthenticatedRequestUser {
  return {
    userId: user.userId,
    email: user.email,
    fullName: user.fullName,
    phoneNumber: user.phoneNumber,
    role: user.role,
    isActive: user.isActive,
    hasLogged: user.hasLogged,
    identityProviderId: user.identityProviderId,
    identityProviderUserId: user.identityProviderUserId,
  };
}
