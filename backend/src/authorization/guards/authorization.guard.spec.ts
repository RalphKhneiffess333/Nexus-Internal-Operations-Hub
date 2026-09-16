import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, beforeEach, expect, it, jest } from '@jest/globals';
import { UserRole } from '@prisma/client';
import type { AuthenticatedRequest } from '../../authentication/request-user';
import { PUBLIC_KEY, ROLES_KEY } from '../authorization.constants';
import { AuthorizationGuard } from './authorization.guard';

describe('AuthorizationGuard', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let guard: AuthorizationGuard;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn<Reflector['getAllAndOverride']>(),
    };
    guard = new AuthorizationGuard(reflector as unknown as Reflector);
  });

  it('allows public endpoints without an authenticated user', () => {
    reflector.getAllAndOverride.mockImplementation((key) =>
      key === PUBLIC_KEY ? true : undefined,
    );

    expect(guard.canActivate(contextFor({ user: null }))).toBe(true);
  });

  it('rejects protected endpoints without an authenticated user', () => {
    reflector.getAllAndOverride.mockImplementation((key) =>
      key === ROLES_KEY ? [UserRole.Employee] : undefined,
    );

    expect(() => guard.canActivate(contextFor({ user: null }))).toThrow(
      UnauthorizedException,
    );
  });

  it('allows an authenticated user with an allowed role', () => {
    reflector.getAllAndOverride.mockImplementation((key) =>
      key === ROLES_KEY ? [UserRole.Agent, UserRole.Admin] : undefined,
    );

    expect(
      guard.canActivate(contextFor({ user: requestUser(UserRole.Agent) })),
    ).toBe(true);
  });

  it('rejects an authenticated user with a disallowed role', () => {
    reflector.getAllAndOverride.mockImplementation((key) =>
      key === ROLES_KEY ? [UserRole.Agent, UserRole.Admin] : undefined,
    );

    expect(() =>
      guard.canActivate(contextFor({ user: requestUser(UserRole.Employee) })),
    ).toThrow(ForbiddenException);
  });

  function contextFor(
    request: Partial<AuthenticatedRequest>,
  ): ExecutionContext {
    return {
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  function requestUser(role: UserRole): AuthenticatedRequest['user'] {
    return {
      userId: 'user-1',
      email: 'user@company.com',
      fullName: 'User',
      phoneNumber: null,
      role,
      isActive: true,
      hasLogged: true,
      identityProviderId: 'idp-entra',
      identityProviderUserId: 'user-1',
    };
  }
});
