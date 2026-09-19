import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditRepository } from './audit.repository';
import { DatabaseModule } from '../database/database.module';
import { TicketEventsModule } from '../tickets/events/ticket-events.module';

@Module({
  imports: [DatabaseModule, TicketEventsModule],
  controllers: [AuditController],
  providers: [AuditService, AuditRepository],
  exports: [AuditService],
})
export class AuditModule {}
