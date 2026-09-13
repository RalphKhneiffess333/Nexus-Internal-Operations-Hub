import { UnauthorizedException } from '@nestjs/common';
import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { User, UserRole } from '@prisma/client';
import { AuthenticationService } from './authentication.service';
import { AuthenticatedIdentity } from './strategies/authenticated-identity';
import { MicrosoftAuthStrategy } from './strategies/microsoft-auth.strategy';
import { SessionService } from './sessions/session.service';
import { UsersService } from '../users/users.service';

describe('AuthenticationService', () => {
  let microsoftAuthStrategy: jest.Mocked<
    Pick<MicrosoftAuthStrategy, 'getAuthorizationUrl' | 'authenticate'>
  >;
  let usersService: jest.Mocked<
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
  let sessionService: jest.Mocked<
    Pick<SessionService, 'createSession' | 'deleteSession'>
  >;
  let service: AuthenticationService;

  const identity: AuthenticatedIdentity = {
    provider: 'MICROSOFT_ENTRA_ID',
    providerUserId: 'entra-user-1',
    email: 'alex@company.com',
    displayName: 'Alex Employee',
  };

  beforeEach(() => {
    microsoftAuthStrategy = {
      getAuthorizationUrl: jest.fn((state) => `https://login.test/${state}`),
      authenticate: jest.fn().mockResolvedValue(identity),
    };
    usersService = {
      findIdentityProviderByCode: jest.fn().mockResolvedValue({
        identityProviderId: 'idp-entra',
        code: 'MICROSOFT_ENTRA_ID',
        name: 'Microsoft Entra ID',
        active: true,
        createdAt: new Date(),
      }),
      findByIdentity: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      linkIdentity: jest.fn(),
      markAsLoggedIn: jest.fn(),
    };
    sessionService = {
      deleteSession: jest.fn(),
      createSession: jest.fn().mockReturnValue({
        sessionId: 'session-1',
        userId: 'user-1',
        device: {},
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        expiresAt: new Date(),
      }),
    };

    service = new AuthenticationService(
      microsoftAuthStrategy as MicrosoftAuthStrategy,
      usersService as UsersService,
      sessionService as SessionService,
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
