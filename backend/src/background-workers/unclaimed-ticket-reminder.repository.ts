import { Injectable } from '@nestjs/common';
import { TicketPriority, TicketStatus } from '@prisma/client';
import { mapPrismaError } from '../database/prisma-error';
import { PrismaService } from '../database/prisma.service';

export interface UnclaimedTicketCandidate {
  ticketId: string;
  ticketCode: string;
  title: string;
  departmentId: string;
  priority: TicketPriority;
  unclaimedSince: Date | null;
}

export interface TicketReminderConfiguration {
  key: string;
  value: string;
}

@Injectable()
export class UnclaimedTicketReminderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCandidates(): Promise<UnclaimedTicketCandidate[]> {
    try {
      return await this.prisma.ticket.findMany({
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
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async markReminderSent(
    ticketId: string,
    unclaimedSince: Date,
    reminderAt: Date,
  ): Promise<boolean> {
    try {
      const result = await this.prisma.ticket.updateMany({
        where: {
          ticketId,
          active: true,
          agentId: null,
          status: { in: [TicketStatus.OPEN, TicketStatus.REOPENED] },
          lastReminderAt: null,
          unclaimedSince,
        },
        data: { lastReminderAt: reminderAt },
      });
      return result.count > 0;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findConfigurations(
    keys: string[],
  ): Promise<TicketReminderConfiguration[]> {
    try {
      return await this.prisma.systemConfiguration.findMany({
        where: { key: { in: keys } },
        select: { key: true, value: true },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }
}
