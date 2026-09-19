import { Injectable, Optional } from '@nestjs/common';
import { TicketEventAction } from '@prisma/client';
import { DepartmentsRepository } from '../departments/repositories/departments.repository';
import { EmailNotificationsService } from '../notifications/email-notifications.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import type { TicketRecord } from './repositories/tickets.repository';

@Injectable()
export class TicketNotificationService {
  constructor(
    private readonly departmentsRepository: DepartmentsRepository,
    private readonly notifications: NotificationsService,
    @Optional()
    private readonly emailNotifications?: EmailNotificationsService,
  ) {}

  async notifyLifecycle(
    ticket: TicketRecord,
    action: 'SUBMISSION' | 'REOPEN',
    actorId: string,
  ): Promise<void> {
    const department = await this.departmentsRepository.findById(
      ticket.departmentId,
    );
    const reopened = action === TicketEventAction.REOPEN;
    await this.notifications.notifyDepartmentAgents(
      ticket.departmentId,
      {
        type: reopened ? 'TICKET_REOPENED' : 'TICKET_OPENED',
        message: `New ticket ${reopened ? 'reopened' : 'opened'} in ${department?.name ?? 'your department'}.`,
        ticketId: ticket.ticketId,
        link: `/tickets/${ticket.ticketId}`,
      },
      actorId,
    );
  }

  notifySubmitter(
    ticket: TicketRecord,
    actorId: string,
    type: 'TICKET_CLAIMED' | 'TICKET_CLOSED' | 'TICKET_UPDATED',
    message: string,
  ): void {
    if (ticket.submittedBy === actorId) return;
    this.notifications.notify({
      type,
      message,
      recipientUserIds: [ticket.submittedBy],
      ticketId: ticket.ticketId,
      link: `/tickets/${ticket.ticketId}`,
    });
  }

  notifyEmail(
    ticket: TicketRecord,
    action: TicketEventAction,
    actor: AuthenticatedRequestUser,
  ): void {
    if (!this.emailNotifications) return;
    switch (action) {
      case TicketEventAction.SUBMISSION:
        void this.emailNotifications.notifyTicketSubmitted(
          ticket.ticketId,
          actor.userId,
        );
        break;
      case TicketEventAction.CLAIM:
        void this.emailNotifications.notifyTicketClaimed(
          ticket.ticketId,
          actor.userId,
        );
        break;
      case TicketEventAction.CLOSE:
        void this.emailNotifications.notifyTicketClosed(
          ticket.ticketId,
          actor.userId,
        );
        break;
      case TicketEventAction.REOPEN:
        void this.emailNotifications.notifyTicketReopened(
          ticket.ticketId,
          actor.userId,
        );
        break;
    }
  }
}
