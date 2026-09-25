import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { NotificationsRepository } from './notifications.repository';
import {
  RealtimeInternalEvent,
  type AppNotificationRealtimeEvent,
  type AppNotificationType,
} from '../realtime/realtime-events';

export interface NotificationInput {
  type: AppNotificationType;
  message: string;
  recipientUserIds: string[];
  ticketId?: string;
  link?: string;
  blocking?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly events: EventEmitter2,
    private readonly notificationsRepository: NotificationsRepository,
  ) {}

  notify(input: NotificationInput): void {
    const recipientUserIds = [...new Set(input.recipientUserIds)].filter(
      Boolean,
    );
    if (!recipientUserIds.length) return;
    const event: AppNotificationRealtimeEvent = {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      version: 1,
      recipientUserIds,
      payload: {
        type: input.type,
        message: input.message,
        ticketId: input.ticketId,
        link: input.link,
        blocking: input.blocking ?? false,
      },
    };
    this.events.emit(RealtimeInternalEvent.AppNotification, event);
  }

  async notifyDepartmentAgents(
    departmentId: string,
    input: Omit<NotificationInput, 'recipientUserIds'>,
    excludeUserId?: string,
  ): Promise<void> {
    this.notify({
      ...input,
      recipientUserIds:
        await this.notificationsRepository.findActiveDepartmentRecipientIds(
          departmentId,
          excludeUserId,
        ),
    });
  }

  async notifyChatViewers(
    departmentId: string,
    submitterId: string,
    input: Omit<NotificationInput, 'recipientUserIds'>,
    excludeUserId?: string,
  ): Promise<void> {
    this.notify({
      ...input,
      recipientUserIds:
        await this.notificationsRepository.findActiveChatRecipientIds(
          departmentId,
          submitterId,
          excludeUserId,
        ),
    });
  }
}
