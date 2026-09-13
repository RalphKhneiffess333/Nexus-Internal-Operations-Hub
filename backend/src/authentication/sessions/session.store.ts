import { Injectable } from '@nestjs/common';
import { Session } from './session.entity';

@Injectable()
export class SessionStore {
  private readonly sessions = new Map<string, Session>();

  set(session: Session): void {
    this.sessions.set(session.sessionId, session);
  }

  get(sessionId: string): Session | null {
    return this.sessions.get(sessionId) ?? null;
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  deleteByUserId(userId: string): void {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(sessionId);
      }
    }
  }

  all(): Session[] {
    return Array.from(this.sessions.values());
  }
}
