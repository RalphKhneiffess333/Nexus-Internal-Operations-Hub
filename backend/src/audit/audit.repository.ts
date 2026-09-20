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

const actorListSelect = {
  userId: true,
  fullName: true,
} satisfies Prisma.UserSelect;

const auditInclude = {
  actor: { select: actorSelect },
} satisfies Prisma.AuditLogInclude;

const auditListSelect = {
  auditLogId: true,
  actorId: true,
  action: true,
  createdAt: true,
  actor: { select: actorListSelect },
} satisfies Prisma.AuditLogSelect;

export type AuditLogRecord = Prisma.AuditLogGetPayload<{
  include: typeof auditInclude;
}>;

export type AuditLogListRecord = Prisma.AuditLogGetPayload<{
  select: typeof auditListSelect;
}>;

export interface ActivityListRecord {
  id: string;
  source: 'audit' | 'ticket';
  action: string;
  createdAt: Date;
  actor: { userId: string; fullName: string } | null;
  ticketId: string | null;
  ticket: { ticketId: string; ticketCode: string; title: string } | null;
}

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
  ): Promise<{ items: AuditLogListRecord[]; total: number }> {
    try {
      const [items, total] = await this.prisma.$transaction([
        this.prisma.auditLog.findMany({
          where,
          select: auditListSelect,
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

  async listActivity(
    source: 'all' | 'audit' | 'ticket',
    auditAction: string | undefined,
    ticketAction: string | undefined,
    skip: number,
    take: number,
  ): Promise<ActivityListRecord[]> {
    const branches: Prisma.Sql[] = [];

    if (source !== 'ticket') {
      const actionFilter = auditAction
        ? Prisma.sql`AND al.action = ${auditAction}::"AuditAction"`
        : Prisma.empty;
      branches.push(Prisma.sql`
        SELECT
          al.audit_log_id AS "id",
          'audit'::text AS "source",
          al.action::text AS "action",
          al.created_at AS "createdAt",
          u.user_id AS "actorId",
          u.full_name AS "actorFullName",
          NULL::text AS "ticketId",
          NULL::text AS "ticketCode",
          NULL::text AS "ticketTitle"
        FROM "audit_logs" al
        LEFT JOIN "users" u ON u.user_id = al.actor_id
        WHERE 1 = 1 ${actionFilter}
      `);
    }

    if (source !== 'audit') {
      const actionFilter = ticketAction
        ? Prisma.sql`AND te.action = ${ticketAction}::"TicketEventAction"`
        : Prisma.empty;
      branches.push(Prisma.sql`
        SELECT
          te.ticket_event_id AS "id",
          'ticket'::text AS "source",
          te.action::text AS "action",
          te.created_at AS "createdAt",
          u.user_id AS "actorId",
          u.full_name AS "actorFullName",
          t.ticket_id AS "ticketId",
          t.ticket_code AS "ticketCode",
          t.title AS "ticketTitle"
        FROM "ticket_events" te
        JOIN "users" u ON u.user_id = te.user_id
        JOIN "tickets" t ON t.ticket_id = te.ticket_id
        WHERE 1 = 1 ${actionFilter}
      `);
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        source: 'audit' | 'ticket';
        action: string;
        createdAt: Date;
        actorId: string | null;
        actorFullName: string | null;
        ticketId: string | null;
        ticketCode: string | null;
        ticketTitle: string | null;
      }>
    >(Prisma.sql`
      WITH activity AS (
        ${Prisma.join(branches, ' UNION ALL ')}
      )
      SELECT *
      FROM activity
      ORDER BY "createdAt" DESC, "id" DESC
      OFFSET ${skip}
      LIMIT ${take}
    `);

    return rows.map((row) => ({
      id: row.id,
      source: row.source,
      action: row.action,
      createdAt: row.createdAt,
      actor:
        row.actorId && row.actorFullName
          ? { userId: row.actorId, fullName: row.actorFullName }
          : null,
      ticketId: row.ticketId,
      ticket:
        row.ticketId && row.ticketCode && row.ticketTitle
          ? {
              ticketId: row.ticketId,
              ticketCode: row.ticketCode,
              title: row.ticketTitle,
            }
          : null,
    }));
  }
}
