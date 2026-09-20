import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { RealtimeInternalEvent } from '../realtime/realtime-events';
import { UserInternalEvent } from '../users/user-events';
import type { UserDeactivatedEvent } from '../users/user-events';
import { SessionService } from './sessions/session.service';

@Injectable()
export class UserSessionInvalidationListener {
  constructor(
    private readonly sessions: SessionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(UserInternalEvent.Deactivated)
  handleUserDeactivated(event: UserDeactivatedEvent): void {
    const sessionIds = this.sessions.deleteSessionsForUser(event.userId);
    this.eventEmitter.emit(RealtimeInternalEvent.SessionInvalidated, {
      userId: event.userId,
      sessionIds,
      reason: 'DEACTIVATED',
    });
  }
}
