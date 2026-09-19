import { Module } from '@nestjs/common';
import { DepartmentsModule } from '../departments/departments.module';
import { FilesModule } from '../files/files.module';
import { TicketEventsRepository } from './events/ticket-events.repository';
import { CancelTicketPolicy } from './policies/cancel-ticket.policy';
import { ClaimTicketPolicy } from './policies/claim-ticket.policy';
import { CloseTicketPolicy } from './policies/close-ticket.policy';
import { ModifyTicketPolicy } from './policies/modify-ticket.policy';
import { ReopenTicketPolicy } from './policies/reopen-ticket.policy';
import { SubmitTicketPolicy } from './policies/submit-ticket.policy';
import { ViewTicketPolicy } from './policies/view-ticket.policy';
import { TicketsRepository } from './repositories/tickets.repository';
import { TicketLifecycleRepository } from './repositories/ticket-lifecycle.repository';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { HandoffPolicy } from './handoffs/handoff.policy';
import { HandoffsController } from './handoffs/handoffs.controller';
import { HandoffsRepository } from './handoffs/handoffs.repository';
import { HandoffsService } from './handoffs/handoffs.service';
import { TicketRealtimePublisher } from './realtime/ticket-realtime.publisher';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DepartmentsModule, FilesModule, NotificationsModule],
  controllers: [TicketsController, HandoffsController],
  providers: [
    TicketsService,
    TicketsRepository,
    TicketEventsRepository,
    TicketLifecycleRepository,
    SubmitTicketPolicy,
    ClaimTicketPolicy,
    CloseTicketPolicy,
    ReopenTicketPolicy,
    ModifyTicketPolicy,
    CancelTicketPolicy,
    ViewTicketPolicy,
    HandoffPolicy,
    HandoffsRepository,
    HandoffsService,
    TicketRealtimePublisher,
  ],
  exports: [
    TicketEventsRepository,
    HandoffsService,
    TicketsService,
    TicketsRepository,
    ViewTicketPolicy,
  ],
})
export class TicketsModule {}
