import { jest, describe, expect, it } from '@jest/globals';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RealtimeInternalEvent } from '../realtime/realtime-events';
import { SessionService } from './sessions/session.service';
import { UserInternalEvent } from '../users/user-events';
import { UserSessionInvalidationListener } from './user-session-invalidation.listener';

describe('UserSessionInvalidationListener', () => {
  it('deletes sessions and emits the existing realtime invalidation event', () => {
    const deleteSessionsForUser = jest
      .fn()
      .mockReturnValue(['session-1', 'session-2']);
    const emit = jest.fn();
    const listener = new UserSessionInvalidationListener(
      { deleteSessionsForUser } as unknown as SessionService,
      { emit } as unknown as EventEmitter2,
    );

    listener.handleUserDeactivated({ userId: 'user-1' });

    expect(deleteSessionsForUser).toHaveBeenCalledWith('user-1');
    expect(emit).toHaveBeenCalledWith(
      RealtimeInternalEvent.SessionInvalidated,
      {
        userId: 'user-1',
        sessionIds: ['session-1', 'session-2'],
        reason: 'DEACTIVATED',
      },
    );
    expect(UserInternalEvent.Deactivated).toBe('user.deactivated');
  });
});
