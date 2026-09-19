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
import { HandoffCancellationService } from './handoffs/handoff-cancellation.service';
import { HandoffLifecycleService } from './handoffs/handoff-lifecycle.service';
import { HandoffQueryService } from './handoffs/handoff-query.service';
import { HandoffResponseMapper } from './handoffs/handoff-response.mapper';
import { HandoffsController } from './handoffs/handoffs.controller';
import { HandoffsRepository } from './handoffs/handoffs.repository';
import { HandoffsService } from './handoffs/handoffs.service';
import { TicketRealtimePublisher } from './realtime/ticket-realtime.publisher';
import { NotificationsModule } from '../notifications/notifications.module';
import { TicketAssignmentReconciliationService } from './ticket-assignment-reconciliation.service';
import { TicketResponseMapper } from './ticket-response.mapper';
import { TicketNotificationService } from './ticket-notification.service';
import { TicketAccessService } from './ticket-access.service';
import { TicketQueryService } from './ticket-query.service';
import { TicketLifecycleService } from './ticket-lifecycle.service';

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
    HandoffCancellationService,
    HandoffLifecycleService,
    HandoffQueryService,
    HandoffResponseMapper,
    HandoffsService,
    TicketRealtimePublisher,
    TicketAssignmentReconciliationService,
    TicketResponseMapper,
    TicketNotificationService,
    TicketAccessService,
    TicketQueryService,
    TicketLifecycleService,
  ],
  exports: [
    TicketEventsRepository,
    HandoffsService,
    TicketsService,
    TicketsRepository,
    ViewTicketPolicy,
    TicketAssignmentReconciliationService,
  ],
})
export class TicketsModule {}
