import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HandoffStatus, UserRole } from '@prisma/client';
import {
  EMAIL_PROVIDER,
  type EmailProvider,
  type EmailRecipient,
} from './email-provider';
import {
  handoffAcceptedTemplate,
  handoffRejectedTemplate,
  handoffRequestedTemplate,
  ticketClaimedTemplate,
  ticketClosedTemplate,
  ticketReminderTemplate,
  ticketReopenedTemplate,
  ticketSubmittedTemplate,
  type HandoffEmailContext,
  type TicketEmailContext,
} from './email-templates';
import {
  EmailHandoffRecord,
  EmailTicketRecord,
  NotificationsRepository,
} from './notifications.repository';
import {
  type SystemErrorDetails,
  logSystemError,
} from '../common/logging/system-error.logger';

type EmailUser = EmailTicketRecord['submitter'];

@Injectable()
export class EmailNotificationsService {
  private readonly logger = new Logger(EmailNotificationsService.name);
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;
  private readonly baseUrl: string;

  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly config: ConfigService,
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
  ) {
    this.maxAttempts = this.readPositiveInteger('EMAIL_MAX_ATTEMPTS', 3);
    this.retryDelayMs = this.readPositiveInteger('EMAIL_RETRY_DELAY_MS', 250);
    this.baseUrl =
      this.config.get<string>('APP_BASE_URL')?.trim() ||
      this.config.get<string>('FRONTEND_URL')?.trim() ||
      'http://localhost:5173';
  }

  async notifyTicketSubmitted(
    ticketId: string,
    actorId: string,
  ): Promise<void> {
    const errorDetails = this.ticketErrorDetails('ticket-submitted', ticketId);
    await this.runSafely(errorDetails, async () => {
      const ticket = await this.findTicket(ticketId);
      if (!ticket) return;
      const recipients = this.departmentRecipients(ticket, actorId);
      await this.dispatch(
        recipients,
        ticketSubmittedTemplate(this.ticketContext(ticket)),
        errorDetails,
      );
    });
  }

  async notifyTicketClaimed(ticketId: string, actorId: string): Promise<void> {
    const errorDetails = this.ticketErrorDetails('ticket-claimed', ticketId);
    await this.runSafely(errorDetails, async () => {
      const ticket = await this.findTicket(ticketId);
      if (!ticket || ticket.submitter.userId === actorId) return;
      await this.dispatch(
        [this.recipient(ticket.submitter)],
        ticketClaimedTemplate(this.ticketContext(ticket)),
        errorDetails,
      );
    });
  }

  async notifyTicketClosed(ticketId: string, actorId: string): Promise<void> {
    const errorDetails = this.ticketErrorDetails('ticket-closed', ticketId);
    await this.runSafely(errorDetails, async () => {
      const ticket = await this.findTicket(ticketId);
      if (!ticket || ticket.submitter.userId === actorId) return;
      await this.dispatch(
        [this.recipient(ticket.submitter)],
        ticketClosedTemplate(this.ticketContext(ticket)),
        errorDetails,
      );
    });
  }

  async notifyTicketReopened(ticketId: string, actorId: string): Promise<void> {
    const errorDetails = this.ticketErrorDetails('ticket-reopened', ticketId);
    await this.runSafely(errorDetails, async () => {
      const ticket = await this.findTicket(ticketId);
      if (!ticket) return;
      const recipients = [
        ...(ticket.submitter.userId === actorId
          ? []
          : [this.recipient(ticket.submitter)]),
        ...this.departmentRecipients(ticket, actorId),
      ];
      await this.dispatch(
        recipients,
        ticketReopenedTemplate(this.ticketContext(ticket)),
        errorDetails,
      );
    });
  }

  async notifyTicketReminder(ticketId: string): Promise<void> {
    const errorDetails = this.ticketErrorDetails('ticket-reminder', ticketId);
    await this.runSafely(errorDetails, async () => {
      const ticket = await this.findTicket(ticketId);
      if (!ticket) return;
      await this.dispatch(
        this.departmentRecipients(ticket),
        ticketReminderTemplate(this.ticketContext(ticket)),
        errorDetails,
      );
    });
  }

  async notifyHandoffRequested(handoffId: string): Promise<void> {
    const errorDetails = this.handoffErrorDetails(
      'handoff-requested',
      handoffId,
    );
    await this.runSafely(errorDetails, async () => {
      const handoff = await this.findHandoff(handoffId);
      if (!handoff || handoff.status !== HandoffStatus.PENDING) return;
      await this.dispatch(
        [this.recipient(handoff.requestedAgent)],
        handoffRequestedTemplate(this.handoffContext(handoff)),
        errorDetails,
      );
    });
  }

  async notifyHandoffAccepted(handoffId: string): Promise<void> {
    const errorDetails = this.handoffErrorDetails(
      'handoff-accepted',
      handoffId,
    );
    await this.runSafely(errorDetails, async () => {
      const handoff = await this.findHandoff(handoffId);
      if (!handoff || handoff.status !== HandoffStatus.ACCEPTED) return;
      await this.dispatch(
        [
          this.recipient(handoff.requester),
          this.recipient(handoff.requestedAgent),
          this.recipient(handoff.ticket.submitter),
        ],
        handoffAcceptedTemplate(this.handoffContext(handoff)),
        errorDetails,
      );
    });
  }

  async notifyHandoffRejected(handoffId: string): Promise<void> {
    const errorDetails = this.handoffErrorDetails(
      'handoff-rejected',
      handoffId,
    );
    await this.runSafely(errorDetails, async () => {
      const handoff = await this.findHandoff(handoffId);
      if (!handoff || handoff.status !== HandoffStatus.REJECTED) return;
      await this.dispatch(
        [this.recipient(handoff.requester)],
        handoffRejectedTemplate(this.handoffContext(handoff)),
        errorDetails,
      );
    });
  }

  private async findTicket(
    ticketId: string,
  ): Promise<EmailTicketRecord | null> {
    return this.notificationsRepository.findTicket(ticketId);
  }

  private async findHandoff(
    handoffId: string,
  ): Promise<EmailHandoffRecord | null> {
    return this.notificationsRepository.findHandoff(handoffId);
  }

  private ticketContext(ticket: EmailTicketRecord): TicketEmailContext {
    return {
      ticketId: ticket.ticketId,
      ticketCode: ticket.ticketCode,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      departmentName: ticket.department.name,
      submitterName: ticket.submitter.fullName,
      completionNotes: ticket.completionNotes,
      ticketLink: this.ticketLink(ticket.ticketId),
    };
  }

  private handoffContext(handoff: EmailHandoffRecord): HandoffEmailContext {
    return {
      handoffId: handoff.handoffId,
      ticketCode: handoff.ticket.ticketCode,
      ticketTitle: handoff.ticket.title,
      departmentName: handoff.ticket.department.name,
      requesterName: handoff.requester.fullName,
      requestedAgentName: handoff.requestedAgent.fullName,
      message: handoff.message,
      ticketLink: this.ticketLink(handoff.ticket.ticketId),
    };
  }

  private departmentRecipients(
    ticket: EmailTicketRecord,
    excludeUserId?: string,
  ): EmailRecipient[] {
    return ticket.department.members
      .filter(
        ({ user }) =>
          user.isActive &&
          (user.role === UserRole.Agent || user.role === UserRole.Admin) &&
          user.userId !== excludeUserId,
      )
      .map(({ user }) => this.recipient(user));
  }

  private recipient(user: EmailUser): EmailRecipient {
    return { email: user.email.trim(), name: user.fullName.trim() };
  }

  private async dispatch(
    recipients: EmailRecipient[],
    template: { subject: string; text: string; html: string },
    errorDetails: SystemErrorDetails,
  ): Promise<void> {
    const uniqueRecipients = new Map<string, EmailRecipient>();
    for (const recipient of recipients) {
      if (!this.isValidEmail(recipient.email)) continue;
      uniqueRecipients.set(recipient.email.toLowerCase(), recipient);
    }
    for (const recipient of uniqueRecipients.values()) {
      await this.sendWithRetry({ ...template, to: recipient }, errorDetails);
    }
  }

  private async sendWithRetry(
    message: {
      to: EmailRecipient;
      subject: string;
      text: string;
      html: string;
    },
    errorDetails: SystemErrorDetails,
  ): Promise<void> {
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        await this.provider.send(message);
        return;
      } catch (error) {
        if (!this.isTransient(error) || attempt === this.maxAttempts) {
          logSystemError(this.logger, error, {
            ...errorDetails,
            operation: 'email.send',
            context: { attempt, provider: 'smtp' },
          });
          return;
        }
        await this.delay(this.retryDelayMs * 2 ** (attempt - 1));
      }
    }
  }

  private async runSafely(
    errorDetails: SystemErrorDetails,
    operation: () => Promise<void>,
  ): Promise<void> {
    try {
      await operation();
    } catch (error) {
      logSystemError(this.logger, error, errorDetails);
    }
  }

  private isTransient(error: unknown): boolean {
    if (!error || typeof error !== 'object') return true;
    const statusCode = Number((error as { statusCode?: unknown }).statusCode);
    if (Number.isFinite(statusCode)) {
      return statusCode === 429 || statusCode >= 500;
    }
    const responseCode = Number(
      (error as { responseCode?: unknown }).responseCode,
    );
    if (Number.isFinite(responseCode)) {
      return responseCode >= 400 && responseCode < 500;
    }
    const rawCode = (error as { code?: unknown }).code;
    const code = typeof rawCode === 'string' ? rawCode : '';
    return [
      'ECONNECTION',
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ESOCKET',
      'EAI_AGAIN',
      'ENETUNREACH',
    ].includes(code);
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private ticketLink(ticketId: string): string | undefined {
    try {
      return new URL(
        `/tickets/${encodeURIComponent(ticketId)}`,
        this.baseUrl,
      ).toString();
    } catch (error) {
      logSystemError(this.logger, error, {
        operation: 'email.build-ticket-link',
        object: { type: 'ticket', id: ticketId },
      });
      return undefined;
    }
  }

  private readPositiveInteger(key: string, fallback: number): number {
    const value = Number(this.config.get<string>(key));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  private ticketErrorDetails(
    operation: string,
    ticketId: string,
  ): SystemErrorDetails {
    return {
      operation: `email.${operation}`,
      object: { type: 'ticket', id: ticketId },
    };
  }

  private handoffErrorDetails(
    operation: string,
    handoffId: string,
  ): SystemErrorDetails {
    return {
      operation: `email.${operation}`,
      object: { type: 'handoff', id: handoffId },
    };
  }
}
