import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailNotificationsService } from '../notifications/email-notifications.service';
import { UnclaimedTicketReminderRepository } from './unclaimed-ticket-reminder.repository';

@Injectable()
export class UnclaimedTicketReminderWorker {
  private readonly logger = new Logger(UnclaimedTicketReminderWorker.name);

  constructor(
    private readonly repository: UnclaimedTicketReminderRepository,
    private readonly notifications: NotificationsService,
    private readonly emailNotifications: EmailNotificationsService,
  ) {}

  async runOnce(now = new Date()): Promise<void> {
    const candidates = await this.repository.findCandidates();
    const intervals = await this.readIntervals(
      [...new Set(candidates.map((ticket) => ticket.priority))],
    );

    for (const ticket of candidates) {
      const intervalMinutes = intervals.get(ticket.priority) ?? 0;
      if (!intervalMinutes || !ticket.unclaimedSince) continue;

      const dueAt = new Date(
        ticket.unclaimedSince.getTime() + intervalMinutes * 60 * 1000,
      );
      if (dueAt > now) continue;

      const claimed = await this.repository.markReminderSent(
        ticket.ticketId,
        ticket.unclaimedSince,
        now,
      );
      if (!claimed) continue;

      const message = `Ticket ${ticket.ticketCode} has remained unclaimed for longer than its ${ticket.priority.toLowerCase()} priority reminder interval.`;
      const link = `/tickets/${encodeURIComponent(ticket.ticketId)}`;

      try {
        await this.notifications.notifyDepartmentAgents(ticket.departmentId, {
          type: 'TICKET_REMINDER',
          message,
          ticketId: ticket.ticketId,
          link,
        });
      } catch (error) {
        this.logger.warn(
          `Realtime reminder notification failed for ${ticket.ticketCode}: ${this.describeError(error)}`,
        );
      }

      await this.emailNotifications.notifyTicketReminder(ticket.ticketId);
    }
  }

  private async readIntervals(codes: string[]): Promise<Map<string, number>> {
    const priorities = await this.repository.findPriorityIntervals(codes);
    return new Map(
      priorities.map((priority) => [
        priority.code,
        priority.reminderIntervalMinutes,
      ]),
    );
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
