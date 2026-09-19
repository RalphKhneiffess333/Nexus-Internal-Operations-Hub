import { Injectable, Logger } from '@nestjs/common';
import { AuditLogsCleanupRepository } from './audit-logs-cleanup.repository';

const CLEANUP_BATCH_SIZE = 500;

@Injectable()
export class AuditLogsCleanupWorker {
  private readonly logger = new Logger(AuditLogsCleanupWorker.name);

  constructor(private readonly repository: AuditLogsCleanupRepository) {}

  async runOnce(now = new Date()): Promise<void> {
    const cutoff = new Date(now);
    cutoff.setFullYear(cutoff.getFullYear() - 2);
    let removed = 0;

    while (true) {
      const expiredLogIds = await this.repository.findExpiredIds(
        cutoff,
        CLEANUP_BATCH_SIZE,
      );

      if (expiredLogIds.length === 0) break;

      const deletedCount = await this.repository.deleteBatch(expiredLogIds);
      removed += deletedCount;

      if (deletedCount === 0) break;
    }

    if (removed) {
      this.logger.log(`Removed ${removed} audit log(s) older than two years.`);
    }
  }
}
