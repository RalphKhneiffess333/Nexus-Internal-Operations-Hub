import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mapPrismaError } from '../database/prisma-error';
import { PrismaService } from '../database/prisma.service';

export type AuditPersistenceClient = PrismaService | Prisma.TransactionClient;

const actorSelect = {
  userId: true,
  fullName: true,
  email: true,
} satisfies Prisma.UserSelect;

const auditInclude = {
  actor: { select: actorSelect },
} satisfies Prisma.AuditLogInclude;

export type AuditLogRecord = Prisma.AuditLogGetPayload<{
  include: typeof auditInclude;
}>;

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async append(
    client: Prisma.TransactionClient,
    actorId: string | null,
    action: AuditAction,
    details: Prisma.InputJsonValue,
  ): Promise<void> {
    try {
      await client.auditLog.create({
        data: { auditLogId: randomUUID(), actorId, action, details },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async list(
    where: Prisma.AuditLogWhereInput,
    skip: number,
    take: number,
  ): Promise<{ items: AuditLogRecord[]; total: number }> {
    try {
      const [items, total] = await this.prisma.$transaction([
        this.prisma.auditLog.findMany({
          where,
          include: auditInclude,
          orderBy: [{ createdAt: 'desc' }, { auditLogId: 'desc' }],
          skip,
          take,
        }),
        this.prisma.auditLog.count({ where }),
      ]);
      return { items, total };
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findById(auditLogId: string): Promise<AuditLogRecord | null> {
    try {
      return await this.prisma.auditLog.findUnique({
        where: { auditLogId },
        include: auditInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }
}
