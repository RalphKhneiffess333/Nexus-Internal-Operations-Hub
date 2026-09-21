import { randomUUID } from 'crypto';
import { RealtimeInternalEvent } from '../realtime/realtime-events';

export function filterOptionsChangedEvent(actorId: string) {
  const occurredAt = new Date().toISOString();
  return {
    eventId: randomUUID(),
    occurredAt,
    version: new Date(occurredAt).getTime(),
    actorId,
    type: RealtimeInternalEvent.FilterOptionsChanged,
  };
}
