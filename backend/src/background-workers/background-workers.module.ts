import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditLogsCleanupWorker } from './audit-logs-cleanup.worker';
import { BackgroundWorkersService } from './background-workers.service';
import { OrphanedFilesWorker } from './orphaned-files.worker';
import { UnclaimedTicketReminderWorker } from './unclaimed-ticket-reminder.worker';

@Module({
  imports: [ConfigModule, DatabaseModule, FilesModule, NotificationsModule],
  providers: [
    BackgroundWorkersService,
    OrphanedFilesWorker,
    AuditLogsCleanupWorker,
    UnclaimedTicketReminderWorker,
  ],
})
export class BackgroundWorkersModule {}
