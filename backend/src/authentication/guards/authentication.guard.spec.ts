import { ExecutionContext } from '@nestjs/common';
import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { SESSION_COOKIE_NAME } from '../authentication.constants';
import { AuthenticatedRequest } from '../request-user';
import { AuthenticationService } from '../authentication.service';
import { AuthenticationGuard } from './authentication.guard';

describe('AuthenticationGuard', () => {
  let authenticationService: jest.Mocked<
    Pick<AuthenticationService, 'authenticateSession'>
  >;
  let guard: AuthenticationGuard;

  beforeEach(() => {
    authenticationService = {
      authenticateSession: jest.fn<AuthenticationService['authenticateSession']>(),
    };
    guard = new AuthenticationGuard(
      authenticationService as unknown as AuthenticationService,
    );
  });

  it('continues with a null user when there is no session cookie', async () => {
    const request = requestWithCookie();

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(request.user).toBeNull();
    expect(request.sessionId).toBeNull();
    expect(authenticationService.authenticateSession).not.toHaveBeenCalled();
  });

  it('continues with a null user when the session is missing or expired', async () => {
    authenticationService.authenticateSession.mockResolvedValue(null);
    const request = requestWithCookie(`${SESSION_COOKIE_NAME}=expired`);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(request.user).toBeNull();
    expect(request.sessionId).toBeNull();
  });

  it('attaches the active user and refreshes the session', async () => {
    authenticationService.authenticateSession.mockResolvedValue({
      userId: 'user-1',
      email: 'alex@company.com',
      fullName: 'Alex Employee',
      phoneNumber: null,
      role: 'Employee',
      isActive: true,
      hasLogged: true,
      identityProviderId: 'idp-entra',
      identityProviderUserId: 'entra-user-1',
    });
    const request = requestWithCookie(`${SESSION_COOKIE_NAME}=session-1`);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(request.sessionId).toBe('session-1');
    expect(request.user?.userId).toBe('user-1');
    expect(authenticationService.authenticateSession).toHaveBeenCalledWith(
      'session-1',
    );
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
