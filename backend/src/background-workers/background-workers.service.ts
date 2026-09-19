import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditLogsCleanupWorker } from './audit-logs-cleanup.worker';
import { OrphanedFilesWorker } from './orphaned-files.worker';
import { UnclaimedTicketReminderWorker } from './unclaimed-ticket-reminder.worker';

interface ScheduledWorker {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
}

@Injectable()
export class BackgroundWorkersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackgroundWorkersService.name);
  private readonly timers: NodeJS.Timeout[] = [];
  private readonly running = new Set<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly orphanedFiles: OrphanedFilesWorker,
    private readonly auditLogs: AuditLogsCleanupWorker,
    private readonly ticketReminders: UnclaimedTicketReminderWorker,
  ) {}

  onModuleInit(): void {
    if (!this.isEnabled()) {
      this.logger.log('Background workers are disabled.');
      return;
    }

    const workers: ScheduledWorker[] = [
      {
        name: 'orphaned file cleanup',
        intervalMs: this.readInterval(
          'ORPHANED_FILE_CLEANUP_INTERVAL_MS',
          60 * 60 * 1000,
        ),
        run: () => this.orphanedFiles.runOnce(),
      },
      {
        name: 'audit log cleanup',
        intervalMs: this.readInterval(
          'AUDIT_LOG_CLEANUP_INTERVAL_MS',
          24 * 60 * 60 * 1000,
        ),
        run: () => this.auditLogs.runOnce(),
      },
      {
        name: 'unclaimed ticket reminder',
        intervalMs: this.readInterval(
          'UNCLAIMED_TICKET_REMINDER_INTERVAL_MS',
          5 * 60 * 1000,
        ),
        run: () => this.ticketReminders.runOnce(),
      },
    ];

    for (const worker of workers) {
      void this.runWorker(worker);
      const timer = setInterval(
        () => void this.runWorker(worker),
        worker.intervalMs,
      );
      timer.unref?.();
      this.timers.push(timer);
    }
  }

  onModuleDestroy(): void {
    for (const timer of this.timers) clearInterval(timer);
    this.timers.length = 0;
  }

  private async runWorker(worker: ScheduledWorker): Promise<void> {
    if (this.running.has(worker.name)) return;
    this.running.add(worker.name);
    try {
      await worker.run();
    } catch (error) {
      this.logger.error(`${worker.name} failed: ${this.describeError(error)}`);
    } finally {
      this.running.delete(worker.name);
    }
  }

  private isEnabled(): boolean {
    return this.config.get<string>('BACKGROUND_WORKERS_ENABLED') !== 'false';
  }

  private readInterval(key: string, fallback: number): number {
    const value = Number(this.config.get<string>(key));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
