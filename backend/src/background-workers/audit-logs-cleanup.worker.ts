import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

const CLEANUP_BATCH_SIZE = 500;

@Injectable()
export class AuditLogsCleanupWorker {
  private readonly logger = new Logger(AuditLogsCleanupWorker.name);

  constructor(private readonly prisma: PrismaService) {}

  async runOnce(now = new Date()): Promise<void> {
    const cutoff = new Date(now);
    cutoff.setFullYear(cutoff.getFullYear() - 2);
    let removed = 0;

    while (true) {
      const expiredLogs = await this.prisma.auditLog.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { auditLogId: true },
        orderBy: { createdAt: 'asc' },
        take: CLEANUP_BATCH_SIZE,
      });

      if (expiredLogs.length === 0) break;

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          SELECT set_config('nexus.audit_cleanup', 'on', true)
        `;
        return tx.auditLog.deleteMany({
          where: {
            auditLogId: { in: expiredLogs.map((log) => log.auditLogId) },
          },
        });
      });
      removed += result.count;

      if (result.count === 0) break;
    }

    if (removed) {
      this.logger.log(`Removed ${removed} audit log(s) older than two years.`);
    }
  }
}
