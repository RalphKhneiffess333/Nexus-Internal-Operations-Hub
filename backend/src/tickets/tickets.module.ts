import { Module } from '@nestjs/common';
import { DepartmentsModule } from '../departments/departments.module';
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

@Module({
  imports: [DepartmentsModule],
  controllers: [TicketsController],
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
  ],
})
export class TicketsModule {}
