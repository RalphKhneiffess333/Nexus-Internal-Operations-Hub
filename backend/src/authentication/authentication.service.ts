import { Injectable, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { User } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AUTH_STATE_LIFETIME_MS } from './authentication.constants';
import {
  AuthenticatedRequestUser,
  toAuthenticatedRequestUser,
} from './request-user';
import { AuthenticatedIdentity } from './strategies/authenticated-identity';
import { MicrosoftAuthStrategy } from './strategies/microsoft-auth.strategy';
import { Session, SessionDevice } from './sessions/session.entity';
import { SessionService } from './sessions/session.service';
import { UsersService } from '../users/users.service';
import { RealtimeInternalEvent } from '../realtime/realtime-events';

interface PendingAuthState {
  expiresAt: Date;
}

export interface MicrosoftLoginStart {
  authorizationUrl: string;
  state: string;
}

export interface AuthenticatedLogin {
  user: User;
  session: Session;
}

@Injectable()
export class AuthenticationService {
  private readonly pendingAuthStates = new Map<string, PendingAuthState>();

  constructor(
    private readonly microsoftAuthStrategy: MicrosoftAuthStrategy,
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  startMicrosoftLogin(): MicrosoftLoginStart {
    const state = randomBytes(32).toString('base64url');
    this.pendingAuthStates.set(state, {
      expiresAt: new Date(Date.now() + AUTH_STATE_LIFETIME_MS),
    });

    return {
      authorizationUrl: this.microsoftAuthStrategy.getAuthorizationUrl(state),
      state,
    };
  }

  async completeMicrosoftLogin(
    code: string,
    state: string | undefined,
    stateCookie: string | undefined,
    _currentSessionId: string | undefined,
    device: SessionDevice,
  ): Promise<AuthenticatedLogin> {
    this.assertValidState(state, stateCookie);

    const identity = await this.microsoftAuthStrategy.authenticate({ code });
    const user = await this.resolveUser(identity);
    const session = this.sessionService.createSession(user.userId, device);

    return { user, session };
  }

  logout(sessionId: string | null | undefined): void {
    if (sessionId) {
      const session = this.sessionService.findById(sessionId);
      this.sessionService.deleteSession(sessionId);
      if (session) {
        this.eventEmitter.emit(RealtimeInternalEvent.SessionInvalidated, {
          userId: session.userId,
          sessionIds: [sessionId],
          reason: 'LOGOUT',
        });
      }
    }
  }

  logoutAllDevices(userId: string): void {
    const sessionIds = this.sessionService.deleteSessionsForUser(userId);
    this.eventEmitter.emit(RealtimeInternalEvent.SessionInvalidated, {
      userId,
      sessionIds,
      reason: 'LOGOUT_ALL_DEVICES',
    });
  }

  /**
   * Resolves the opaque session used by both HTTP guards and Socket.IO
   * handshakes. Keeping this here prevents a second authentication flow from
   * drifting away from the browser-session contract.
   */
  async authenticateSession(
    sessionId: string | null | undefined,
  ): Promise<AuthenticatedRequestUser | null> {
    if (!sessionId) {
      return null;
    }

    const session = this.sessionService.findById(sessionId);
    if (!session) {
      return null;
    }

    const user = await this.usersService.findById(session.userId);
    if (!user || !user.isActive) {
      this.sessionService.deleteSession(sessionId);
      return null;
    }

    this.sessionService.refreshSession(sessionId);
    return toAuthenticatedRequestUser(user);
  }

  private async resolveUser(identity: AuthenticatedIdentity): Promise<User> {
    const identityProvider = await this.usersService.findIdentityProviderByCode(
      identity.provider,
    );

    let user = await this.usersService.findByIdentity(
      identityProvider.identityProviderId,
      identity.providerUserId,
    );

    if (!user) {
      user = await this.usersService.findByEmail(identity.email);
      if (user) {
        if (!user.isActive) {
          throw new UnauthorizedException('User account is inactive');
        }
        if (user.hasLogged) {
          throw new UnauthorizedException(
            'Authenticated identity is not linked to this user account',
          );
        }

        user = await this.usersService.linkIdentity(
          user,
          identityProvider.identityProviderId,
          identity.providerUserId,
        );
      }
    }

    if (!user) {
      user = await this.usersService.create({
        email: identity.email,
        fullName: identity.displayName,
        phoneNumber: identity.phoneNumber ?? null,
        identityProviderId: identityProvider.identityProviderId,
        identityProviderUserId: identity.providerUserId,
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    return this.usersService.markAsLoggedIn(user);
  }

  private assertValidState(
    state: string | undefined,
    stateCookie: string | undefined,
  ): void {
    if (!state || !stateCookie || state !== stateCookie) {
      throw new UnauthorizedException(
        'Microsoft authentication state is invalid',
      );
    }

    const pendingState = this.pendingAuthStates.get(state);
    this.pendingAuthStates.delete(state);

    if (!pendingState || pendingState.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Microsoft authentication state expired');
    }
  }
}
