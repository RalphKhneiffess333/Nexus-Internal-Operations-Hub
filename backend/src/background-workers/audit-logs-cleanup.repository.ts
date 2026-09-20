import { Injectable } from '@nestjs/common';
import { mapPrismaError } from '../database/prisma-error';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuditLogsCleanupRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findExpiredIds(cutoff: Date, take: number): Promise<string[]> {
    try {
      const logs = await this.prisma.auditLog.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { auditLogId: true },
        orderBy: { createdAt: 'asc' },
        take,
      });
      return logs.map((log) => log.auditLogId);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async deleteBatch(auditLogIds: string[]): Promise<number> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          SELECT set_config('nexus.audit_cleanup', 'on', true)
        `;
        const result = await tx.auditLog.deleteMany({
          where: { auditLogId: { in: auditLogIds } },
        });
        return result.count;
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }
}
