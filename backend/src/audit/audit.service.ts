import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { AuditQueryDto, TicketEventsQueryDto } from './dto/audit-query.dto';
import { AuditRepository } from './audit.repository';
import { TicketEventsRepository } from '../tickets/events/ticket-events.repository';

@Injectable()
export class AuditService {
  constructor(
    private readonly auditRepository: AuditRepository,
    private readonly ticketEventsRepository: TicketEventsRepository,
  ) {}

  async append(
    client: Prisma.TransactionClient,
    actorId: string | null,
    action: AuditAction,
    details: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.auditRepository.append(client, actorId, action, details);
  }

  async list(query: AuditQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
    };
    const result = await this.auditRepository.list(
      where,
      (query.page - 1) * query.pageSize,
      query.pageSize,
    );
    return {
      items: result.items.map((item) => this.toResponse(item)),
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    };
  }

  async findById(auditLogId: string) {
    const log = await this.auditRepository.findById(auditLogId);
    if (!log) throw new NotFoundException('Audit log was not found');
    return this.toResponse(log);
  }

  listTicketEvents(query: TicketEventsQueryDto) {
    return this.ticketEventsRepository.findAll(
      (query.page - 1) * query.pageSize,
      query.pageSize,
      query.action,
    );
  }

  private toResponse(log: {
    auditLogId: string;
    actorId: string | null;
    action: AuditAction;
    details: Prisma.JsonValue;
    createdAt: Date;
    actor: { userId: string; fullName: string; email: string } | null;
  }) {
    return {
      auditLogId: log.auditLogId,
      actorId: log.actorId,
      action: log.action,
      details: log.details,
      createdAt: log.createdAt,
      actor: log.actor,
    };
  }
}
