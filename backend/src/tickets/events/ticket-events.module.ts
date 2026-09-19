import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { TicketEventsRepository } from './ticket-events.repository';

@Module({
  imports: [DatabaseModule],
  providers: [TicketEventsRepository],
  exports: [TicketEventsRepository],
})
export class TicketEventsModule {}
