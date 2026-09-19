import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { TicketsModule } from '../tickets/tickets.module';
import { AuditRepository } from './audit.repository';

@Module({
  imports: [TicketsModule],
  controllers: [AuditController],
  providers: [AuditService, AuditRepository],
  exports: [AuditService],
})
export class AuditModule {}
