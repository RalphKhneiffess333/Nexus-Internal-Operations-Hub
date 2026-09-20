import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditLogsCleanupWorker } from './audit-logs-cleanup.worker';
import { AuditLogsCleanupRepository } from './audit-logs-cleanup.repository';
import { BackgroundWorkersService } from './background-workers.service';
import { OrphanedFilesWorker } from './orphaned-files.worker';
import { OrphanedFilesRepository } from './orphaned-files.repository';
import { UnclaimedTicketReminderWorker } from './unclaimed-ticket-reminder.worker';
import { UnclaimedTicketReminderRepository } from './unclaimed-ticket-reminder.repository';
import { PrioritiesModule } from '../priorities/priorities.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    FilesModule,
    NotificationsModule,
    PrioritiesModule,
  ],
  providers: [
    BackgroundWorkersService,
    AuditLogsCleanupRepository,
    OrphanedFilesWorker,
    OrphanedFilesRepository,
    AuditLogsCleanupWorker,
    UnclaimedTicketReminderWorker,
    UnclaimedTicketReminderRepository,
  ],
})
export class BackgroundWorkersModule {}
