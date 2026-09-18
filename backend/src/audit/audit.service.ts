import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async append(
    client: Prisma.TransactionClient,
    actorId: string | null,
    action: AuditAction,
    details: Prisma.InputJsonValue,
  ): Promise<void> {
    await client.auditLog.create({
      data: { auditLogId: randomUUID(), actorId, action, details },
    });
  }

  async list(query: AuditQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { userId: true, fullName: true, email: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { auditLogId: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async findById(auditLogId: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { auditLogId },
      include: {
        actor: { select: { userId: true, fullName: true, email: true } },
      },
    });
    if (!log) throw new NotFoundException('Audit log was not found');
    return log;
  }
}
