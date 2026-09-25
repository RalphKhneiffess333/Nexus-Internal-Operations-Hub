import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { mapPrismaError } from '../database/prisma-error';
import { PrismaService } from '../database/prisma.service';

const emailUserSelect = {
  userId: true,
  email: true,
  fullName: true,
  isActive: true,
  role: true,
} satisfies Prisma.UserSelect;

const emailTicketInclude = {
  department: {
    include: {
      members: { include: { user: { select: emailUserSelect } } },
    },
  },
  submitter: { select: emailUserSelect },
  agent: { select: emailUserSelect },
} satisfies Prisma.TicketInclude;

const emailHandoffInclude = {
  requester: { select: emailUserSelect },
  requestedAgent: { select: emailUserSelect },
  ticket: { include: emailTicketInclude },
} satisfies Prisma.HandoffRequestInclude;

export type EmailTicketRecord = Prisma.TicketGetPayload<{
  include: typeof emailTicketInclude;
}>;

export type EmailHandoffRecord = Prisma.HandoffRequestGetPayload<{
  include: typeof emailHandoffInclude;
}>;

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveDepartmentRecipientIds(
    departmentId: string,
    excludeUserId?: string,
  ): Promise<string[]> {
    try {
      const members = await this.prisma.departmentMember.findMany({
        where: {
          departmentId,
          department: { active: true },
          user: {
            isActive: true,
            role: { in: ['Agent', 'Admin'] },
            ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
          },
        },
        select: { userId: true },
      });
      return members.map((member) => member.userId);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findActiveChatRecipientIds(
    departmentId: string,
    submitterId: string,
    excludeUserId?: string,
  ): Promise<string[]> {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          isActive: true,
          ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
          OR: [
            { userId: submitterId },
            { role: UserRole.Admin },
            {
              role: UserRole.Agent,
              departmentMembers: {
                some: {
                  departmentId,
                  department: { active: true },
                },
              },
            },
          ],
        },
        select: { userId: true },
      });
      return users.map((user) => user.userId);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findTicket(ticketId: string): Promise<EmailTicketRecord | null> {
    try {
      return await this.prisma.ticket.findUnique({
        where: { ticketId },
        include: emailTicketInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findHandoff(handoffId: string): Promise<EmailHandoffRecord | null> {
    try {
      return await this.prisma.handoffRequest.findUnique({
        where: { handoffId },
        include: emailHandoffInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }
}
