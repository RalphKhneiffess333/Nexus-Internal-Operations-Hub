import { ExecutionContext } from '@nestjs/common';
import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { UserRole } from '@prisma/client';
import { SESSION_COOKIE_NAME } from '../authentication.constants';
import { AuthenticatedRequest } from '../request-user';
import { SessionService } from '../sessions/session.service';
import { UsersService } from '../../users/users.service';
import { AuthenticationGuard } from './authentication.guard';

describe('AuthenticationGuard', () => {
  let sessionService: jest.Mocked<
    Pick<SessionService, 'findById' | 'refreshSession' | 'deleteSession'>
  >;
  let usersService: jest.Mocked<Pick<UsersService, 'findById'>>;
  let guard: AuthenticationGuard;

  beforeEach(() => {
    sessionService = {
      findById: jest.fn<SessionService['findById']>(),
      refreshSession: jest.fn<SessionService['refreshSession']>(),
      deleteSession: jest.fn<SessionService['deleteSession']>(),
    };
    usersService = {
      findById: jest.fn<UsersService['findById']>(),
    };
    guard = new AuthenticationGuard(
      sessionService as unknown as SessionService,
      usersService as unknown as UsersService,
    );
  });

  it('continues with a null user when there is no session cookie', async () => {
    const request = requestWithCookie();

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(request.user).toBeNull();
    expect(request.sessionId).toBeNull();
    expect(sessionService.findById).not.toHaveBeenCalled();
  });

  it('continues with a null user when the session is missing or expired', async () => {
    sessionService.findById.mockReturnValue(null);
    const request = requestWithCookie(`${SESSION_COOKIE_NAME}=expired`);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(request.user).toBeNull();
    expect(request.sessionId).toBeNull();
  });

  it('attaches the active user and refreshes the session', async () => {
    sessionService.findById.mockReturnValue({
      sessionId: 'session-1',
      userId: 'user-1',
      device: {},
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
    });
    usersService.findById.mockResolvedValue({
      userId: 'user-1',
      email: 'alex@company.com',
      fullName: 'Alex Employee',
      phoneNumber: null,
      role: UserRole.Employee,
      isActive: true,
      hasLogged: true,
      identityProviderId: 'idp-entra',
      identityProviderUserId: 'entra-user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const request = requestWithCookie(`${SESSION_COOKIE_NAME}=session-1`);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(request.sessionId).toBe('session-1');
    expect(request.user?.userId).toBe('user-1');
    expect(sessionService.refreshSession).toHaveBeenCalledWith('session-1');
  });

  function contextFor(
    request: Partial<AuthenticatedRequest>,
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  function requestWithCookie(cookie?: string): Partial<AuthenticatedRequest> {
    return {
      headers: {
        cookie,
      },
    };
  }
});
