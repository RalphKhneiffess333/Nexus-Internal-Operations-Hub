import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { SESSION_LIFETIME_MS } from '../authentication.constants';
import { SessionStore } from './session.store';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let sessionStore: SessionStore;
  let sessionService: SessionService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-13T00:00:00.000Z'));
    sessionStore = new SessionStore();
    sessionService = new SessionService(sessionStore);
  });

  afterEach(() => {
    sessionService.onModuleDestroy();
    jest.useRealTimers();
  });

  it('creates separate opaque sessions for the same user', () => {
    const first = sessionService.createSession('user-1', {
      userAgent: 'Desktop',
    });
    const second = sessionService.createSession('user-1', {
      userAgent: 'Mobile',
    });

    expect(first.sessionId).not.toBe(second.sessionId);
    expect(first.userId).toBe('user-1');
    expect(second.userId).toBe('user-1');
    expect(first.sessionId).not.toContain('user-1');
    expect(sessionStore.all()).toHaveLength(2);
  });

  it('refreshes sessions with a sliding seven-day expiration', () => {
    const session = sessionService.createSession('user-1', {});

    jest.setSystemTime(new Date('2026-09-16T00:00:00.000Z'));
    const refreshed = sessionService.refreshSession(session.sessionId);

    expect(refreshed?.lastAccessedAt).toEqual(
      new Date('2026-09-16T00:00:00.000Z'),
    );
    expect(refreshed?.expiresAt).toEqual(
      new Date(Date.now() + SESSION_LIFETIME_MS),
    );
  });

  it('removes expired sessions during lookup', () => {
    sessionStore.set({
      sessionId: 'expired-session',
      userId: 'user-1',
      device: {},
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      lastAccessedAt: new Date('2026-09-01T00:00:00.000Z'),
      expiresAt: new Date('2026-09-12T23:59:59.999Z'),
    });

    expect(sessionService.findById('expired-session')).toBeNull();
    expect(sessionStore.get('expired-session')).toBeNull();
  });

  it('can delete every session for one user without touching other users', () => {
    sessionService.createSession('user-1', {});
    sessionService.createSession('user-1', {});
    sessionService.createSession('user-2', {});

    sessionService.deleteSessionsForUser('user-1');

    expect(sessionStore.all()).toHaveLength(1);
    expect(sessionStore.all()[0].userId).toBe('user-2');
  });
});
