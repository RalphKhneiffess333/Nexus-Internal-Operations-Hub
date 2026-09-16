import { UnauthorizedException } from '@nestjs/common';
import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { User, UserRole } from '@prisma/client';
import { AUTH_STATE_LIFETIME_MS } from './authentication.constants';
import { AuthenticationService } from './authentication.service';
import { AuthenticatedIdentity } from './strategies/authenticated-identity';
import { MicrosoftAuthStrategy } from './strategies/microsoft-auth.strategy';
import { SessionService } from './sessions/session.service';
import { UsersService } from '../users/users.service';

type MicrosoftAuthStrategyMock = jest.Mocked<
  Pick<MicrosoftAuthStrategy, 'getAuthorizationUrl' | 'authenticate'>
>;

type UsersServiceMock = jest.Mocked<
  Pick<
    UsersService,
    | 'findIdentityProviderByCode'
    | 'findByIdentity'
    | 'findByEmail'
    | 'create'
    | 'linkIdentity'
    | 'markAsLoggedIn'
  >
>;

type SessionServiceMock = jest.Mocked<
  Pick<SessionService, 'createSession' | 'deleteSession'>
>;

describe('AuthenticationService', () => {
  let microsoftAuthStrategy: MicrosoftAuthStrategyMock;
  let usersService: UsersServiceMock;
  let sessionService: SessionServiceMock;
  let service: AuthenticationService;

  const identity: AuthenticatedIdentity = {
    provider: 'MICROSOFT_ENTRA_ID',
    providerUserId: 'entra-user-1',
    email: 'alex@company.com',
    displayName: 'Alex Employee',
  };

  beforeEach(() => {
    microsoftAuthStrategy = {
      getAuthorizationUrl: jest.fn<MicrosoftAuthStrategy['getAuthorizationUrl']>(
        (state) => `https://login.test/${state}`,
      ),
      authenticate: jest
        .fn<MicrosoftAuthStrategy['authenticate']>()
        .mockResolvedValue(identity),
    };
    usersService = {
      findIdentityProviderByCode: jest
        .fn<UsersService['findIdentityProviderByCode']>()
        .mockResolvedValue({
          identityProviderId: 'idp-entra',
          code: 'MICROSOFT_ENTRA_ID',
          name: 'Microsoft Entra ID',
          active: true,
          createdAt: new Date(),
        }),
      findByIdentity: jest.fn<UsersService['findByIdentity']>(),
      findByEmail: jest.fn<UsersService['findByEmail']>(),
      create: jest.fn<UsersService['create']>(),
      linkIdentity: jest.fn<UsersService['linkIdentity']>(),
      markAsLoggedIn: jest.fn<UsersService['markAsLoggedIn']>(),
    };
    sessionService = {
      deleteSession: jest.fn<SessionService['deleteSession']>(),
      createSession: jest
        .fn<SessionService['createSession']>()
        .mockReturnValue({
          sessionId: 'session-1',
          userId: 'user-1',
          device: {},
          createdAt: new Date(),
          lastAccessedAt: new Date(),
          expiresAt: new Date(),
        }),
    };

    service = new AuthenticationService(
      microsoftAuthStrategy as unknown as MicrosoftAuthStrategy,
      usersService as unknown as UsersService,
      sessionService as unknown as SessionService,
    );
  });

  it('creates a user when no identity or email match exists', async () => {
    const createdUser = user({ hasLogged: true });
    usersService.findByIdentity.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(null);
    usersService.create.mockResolvedValue(createdUser);
    usersService.markAsLoggedIn.mockResolvedValue(createdUser);

    const login = service.startMicrosoftLogin();
    await service.completeMicrosoftLogin(
      'code',
      login.state,
      login.state,
      undefined,
      {},
    );

    expect(usersService.create).toHaveBeenCalledWith({
      email: identity.email,
      fullName: identity.displayName,
      phoneNumber: null,
      identityProviderId: 'idp-entra',
      identityProviderUserId: identity.providerUserId,
    });
    expect(sessionService.createSession).toHaveBeenCalledWith('user-1', {});
  });

  it('links a preconfigured active user found by email', async () => {
    const preconfiguredUser = user({
      hasLogged: false,
      identityProviderUserId: 'placeholder-user-id',
    });
    const linkedUser = user({ hasLogged: false });
    const loggedUser = user({ hasLogged: true });
    usersService.findByIdentity.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(preconfiguredUser);
    usersService.linkIdentity.mockResolvedValue(linkedUser);
    usersService.markAsLoggedIn.mockResolvedValue(loggedUser);

    const login = service.startMicrosoftLogin();
    await service.completeMicrosoftLogin(
      'code',
      login.state,
      login.state,
      undefined,
      {},
    );

    expect(usersService.linkIdentity).toHaveBeenCalledWith(
      preconfiguredUser,
      'idp-entra',
      identity.providerUserId,
    );
    expect(usersService.markAsLoggedIn).toHaveBeenCalledWith(linkedUser);
  });

  it('rejects an email match that has already logged in under another identity', async () => {
    usersService.findByIdentity.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(
      user({ hasLogged: true, identityProviderUserId: 'different-id' }),
    );

    const login = service.startMicrosoftLogin();

    await expect(
      service.completeMicrosoftLogin(
        'code',
        login.state,
        login.state,
        undefined,
        {},
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(usersService.linkIdentity).not.toHaveBeenCalled();
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it('rejects login completion when the state is missing', async () => {
    const login = service.startMicrosoftLogin();

    await expect(
      service.completeMicrosoftLogin(
        'code',
        undefined,
        login.state,
        undefined,
        {},
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(microsoftAuthStrategy.authenticate).not.toHaveBeenCalled();
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it('rejects login completion when the state cookie does not match', async () => {
    const login = service.startMicrosoftLogin();

    await expect(
      service.completeMicrosoftLogin(
        'code',
        login.state,
        'different-state',
        undefined,
        {},
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(microsoftAuthStrategy.authenticate).not.toHaveBeenCalled();
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it('rejects login completion when the state has expired', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-16T00:00:00.000Z'));

    try {
      const login = service.startMicrosoftLogin();
      jest.setSystemTime(new Date(Date.now() + AUTH_STATE_LIFETIME_MS + 1));

      await expect(
        service.completeMicrosoftLogin(
          'code',
          login.state,
          login.state,
          undefined,
          {},
        ),
      ).rejects.toThrow(UnauthorizedException);
    } finally {
      jest.useRealTimers();
    }

    expect(microsoftAuthStrategy.authenticate).not.toHaveBeenCalled();
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it('does not create a session when the Microsoft strategy rejects authentication', async () => {
    microsoftAuthStrategy.authenticate.mockRejectedValue(
      new UnauthorizedException('Microsoft token exchange was rejected'),
    );
    const login = service.startMicrosoftLogin();

    await expect(
      service.completeMicrosoftLogin(
        'code',
        login.state,
        login.state,
        undefined,
        {},
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(usersService.findIdentityProviderByCode).not.toHaveBeenCalled();
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it('rejects an inactive user found by identity', async () => {
    usersService.findByIdentity.mockResolvedValue(user({ isActive: false }));

    const login = service.startMicrosoftLogin();

    await expect(
      service.completeMicrosoftLogin(
        'code',
        login.state,
        login.state,
        undefined,
        {},
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(usersService.markAsLoggedIn).not.toHaveBeenCalled();
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it('rejects an inactive preconfigured user found by email', async () => {
    usersService.findByIdentity.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(
      user({ isActive: false, hasLogged: false }),
    );

    const login = service.startMicrosoftLogin();

    await expect(
      service.completeMicrosoftLogin(
        'code',
        login.state,
        login.state,
        undefined,
        {},
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(usersService.linkIdentity).not.toHaveBeenCalled();
    expect(usersService.markAsLoggedIn).not.toHaveBeenCalled();
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it('creates a new login session without deleting the current browser session', async () => {
    const existingUser = user({ hasLogged: true });
    usersService.findByIdentity.mockResolvedValue(existingUser);
    usersService.markAsLoggedIn.mockResolvedValue(existingUser);

    const login = service.startMicrosoftLogin();
    await service.completeMicrosoftLogin(
      'code',
      login.state,
      login.state,
      'old-session',
      {},
    );

    expect(sessionService.deleteSession).not.toHaveBeenCalled();
    expect(sessionService.createSession).toHaveBeenCalledWith('user-1', {});
  });

  function user(overrides: Partial<User> = {}): User {
    return {
      userId: 'user-1',
      email: identity.email,
      fullName: identity.displayName,
      phoneNumber: null,
      role: UserRole.Employee,
      isActive: true,
      hasLogged: false,
      identityProviderId: 'idp-entra',
      identityProviderUserId: identity.providerUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }
});
