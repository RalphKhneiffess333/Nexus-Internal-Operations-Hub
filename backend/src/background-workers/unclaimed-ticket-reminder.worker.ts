import { Injectable, Logger } from '@nestjs/common';
import { TicketPriority, TicketStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailNotificationsService } from '../notifications/email-notifications.service';

const priorityConfigurationKeys: Record<TicketPriority, string> = {
  [TicketPriority.LOW]: 'REMINDER_INTERVAL_LOW_MINUTES',
  [TicketPriority.MODERATE]: 'REMINDER_INTERVAL_MODERATE_MINUTES',
  [TicketPriority.HIGH]: 'REMINDER_INTERVAL_HIGH_MINUTES',
};

@Injectable()
export class UnclaimedTicketReminderWorker {
  private readonly logger = new Logger(UnclaimedTicketReminderWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly emailNotifications: EmailNotificationsService,
  ) {}

  async runOnce(now = new Date()): Promise<void> {
    const intervals = await this.readIntervals();
    const candidates = await this.prisma.ticket.findMany({
      where: {
        active: true,
        agentId: null,
        status: { in: [TicketStatus.OPEN, TicketStatus.REOPENED] },
        unclaimedSince: { not: null },
        lastReminderAt: null,
      },
      select: {
        ticketId: true,
        ticketCode: true,
        title: true,
        departmentId: true,
        priority: true,
        unclaimedSince: true,
      },
      orderBy: { unclaimedSince: 'asc' },
    });

    for (const ticket of candidates) {
      const intervalMinutes = intervals[ticket.priority];
      if (!intervalMinutes || !ticket.unclaimedSince) continue;

      const dueAt = new Date(
        ticket.unclaimedSince.getTime() + intervalMinutes * 60 * 1000,
      );
      if (dueAt > now) continue;

      const claimed = await this.prisma.ticket.updateMany({
        where: {
          ticketId: ticket.ticketId,
          active: true,
          agentId: null,
          status: { in: [TicketStatus.OPEN, TicketStatus.REOPENED] },
          lastReminderAt: null,
          unclaimedSince: ticket.unclaimedSince,
        },
        data: { lastReminderAt: now },
      });
      if (claimed.count === 0) continue;

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

  private async readIntervals(): Promise<Record<TicketPriority, number>> {
    const configurations = await this.prisma.systemConfiguration.findMany({
      where: { key: { in: Object.values(priorityConfigurationKeys) } },
      select: { key: true, value: true },
    });
    const values = new Map(
      configurations.map((configuration) => [
        configuration.key,
        this.readNonNegativeInteger(configuration.value),
      ]),
    );

    return {
      [TicketPriority.LOW]:
        values.get(priorityConfigurationKeys[TicketPriority.LOW]) ?? 0,
      [TicketPriority.MODERATE]:
        values.get(priorityConfigurationKeys[TicketPriority.MODERATE]) ?? 0,
      [TicketPriority.HIGH]:
        values.get(priorityConfigurationKeys[TicketPriority.HIGH]) ?? 0,
    };
  }

  private readNonNegativeInteger(value: string): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
