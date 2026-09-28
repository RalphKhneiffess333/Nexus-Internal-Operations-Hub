import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';
import { RealtimeInternalEvent } from '../realtime/realtime-events';

describe('NotificationsService', () => {
  it('includes the originating user in a chat notification event', () => {
    const events = { emit: jest.fn() } as unknown as EventEmitter2;
    const service = new NotificationsService(
      events,
      {} as NotificationsRepository,
    );

    service.notify({
      type: 'CHAT_MESSAGE',
      message: 'New chat message',
      actorId: 'sender-1',
      recipientUserIds: ['recipient-1'],
      ticketId: 'ticket-1',
    });

    expect(events.emit).toHaveBeenCalledWith(
      RealtimeInternalEvent.AppNotification,
      expect.objectContaining({ actorId: 'sender-1' }),
    );
  });
});
