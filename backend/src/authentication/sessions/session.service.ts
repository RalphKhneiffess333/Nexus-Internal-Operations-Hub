import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { SESSION_LIFETIME_MS } from '../authentication.constants';
import { Session, SessionDevice } from './session.entity';
import { SessionStore } from './session.store';

@Injectable()
export class SessionService implements OnModuleInit, OnModuleDestroy {
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(private readonly sessionStore: SessionStore) {}

  onModuleInit(): void {
    this.cleanupTimer = setInterval(
      () => this.deleteExpiredSessions(),
      60 * 60 * 1000,
    );
    this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  createSession(userId: string, device: SessionDevice): Session {
    const now = new Date();
    const session: Session = {
      sessionId: randomBytes(32).toString('base64url'),
      userId,
      device,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS),
    };

    this.sessionStore.set(session);
    return session;
  }

  findById(sessionId: string): Session | null {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      return null;
    }

    if (this.isExpired(session)) {
      this.sessionStore.delete(sessionId);
      return null;
    }

    return session;
  }

  refreshSession(sessionId: string): Session | null {
    const session = this.findById(sessionId);
    if (!session) {
      return null;
    }

    const now = new Date();
    session.lastAccessedAt = now;
    session.expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);
    this.sessionStore.set(session);
    return session;
  }

  deleteSession(sessionId: string): void {
    this.sessionStore.delete(sessionId);
  }

  deleteSessionsForUser(userId: string): void {
    this.sessionStore.deleteByUserId(userId);
  }

  deleteExpiredSessions(): void {
    for (const session of this.sessionStore.all()) {
      if (this.isExpired(session)) {
        this.sessionStore.delete(session.sessionId);
      }
    }
  }

  private isExpired(session: Session): boolean {
    return session.expiresAt.getTime() <= Date.now();
  }
}
