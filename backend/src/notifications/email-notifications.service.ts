import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HandoffStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
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
  ticketReopenedTemplate,
  ticketSubmittedTemplate,
  type HandoffEmailContext,
  type TicketEmailContext,
} from './email-templates';

interface EmailUser {
  userId: string;
  email: string;
  fullName: string;
  isActive: boolean;
  role: UserRole;
}

interface TicketWithEmailContext {
  ticketId: string;
  ticketCode: string;
  title: string;
  status: TicketEmailContext['status'];
  priority: TicketEmailContext['priority'];
  completionNotes: string | null;
  department: {
    name: string;
    members: Array<{ user: EmailUser }>;
  };
  submitter: EmailUser;
  agent: EmailUser | null;
}

interface HandoffWithEmailContext {
  handoffId: string;
  status: HandoffStatus;
  message: string | null;
  requester: EmailUser;
  requestedAgent: EmailUser;
  ticket: TicketWithEmailContext;
}

@Injectable()
export class EmailNotificationsService {
  private readonly logger = new Logger(EmailNotificationsService.name);
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
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
    await this.runSafely('ticket submission', async () => {
      const ticket = await this.findTicket(ticketId);
      if (!ticket) return;
      const recipients = this.departmentRecipients(ticket, actorId);
      await this.dispatch(
        recipients,
        ticketSubmittedTemplate(this.ticketContext(ticket)),
      );
    });
  }

  async notifyTicketClaimed(ticketId: string, actorId: string): Promise<void> {
    await this.runSafely('ticket claim', async () => {
      const ticket = await this.findTicket(ticketId);
      if (!ticket || ticket.submitter.userId === actorId) return;
      await this.dispatch(
        [this.recipient(ticket.submitter)],
        ticketClaimedTemplate(this.ticketContext(ticket)),
      );
    });
  }

  async notifyTicketClosed(ticketId: string, actorId: string): Promise<void> {
    await this.runSafely('ticket close', async () => {
      const ticket = await this.findTicket(ticketId);
      if (!ticket || ticket.submitter.userId === actorId) return;
      await this.dispatch(
        [this.recipient(ticket.submitter)],
        ticketClosedTemplate(this.ticketContext(ticket)),
      );
    });
  }

  async notifyTicketReopened(ticketId: string, actorId: string): Promise<void> {
    await this.runSafely('ticket reopen', async () => {
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
      );
    });
  }

  async notifyHandoffRequested(handoffId: string): Promise<void> {
    await this.runSafely('handoff request', async () => {
      const handoff = await this.findHandoff(handoffId);
      if (!handoff || handoff.status !== HandoffStatus.PENDING) return;
      await this.dispatch(
        [this.recipient(handoff.requestedAgent)],
        handoffRequestedTemplate(this.handoffContext(handoff)),
      );
    });
  }

  async notifyHandoffAccepted(handoffId: string): Promise<void> {
    await this.runSafely('handoff acceptance', async () => {
      const handoff = await this.findHandoff(handoffId);
      if (!handoff || handoff.status !== HandoffStatus.ACCEPTED) return;
      await this.dispatch(
        [
          this.recipient(handoff.requester),
          this.recipient(handoff.requestedAgent),
          this.recipient(handoff.ticket.submitter),
        ],
        handoffAcceptedTemplate(this.handoffContext(handoff)),
      );
    });
  }

  async notifyHandoffRejected(handoffId: string): Promise<void> {
    await this.runSafely('handoff rejection', async () => {
      const handoff = await this.findHandoff(handoffId);
      if (!handoff || handoff.status !== HandoffStatus.REJECTED) return;
      await this.dispatch(
        [this.recipient(handoff.requester)],
        handoffRejectedTemplate(this.handoffContext(handoff)),
      );
    });
  }

  private async findTicket(
    ticketId: string,
  ): Promise<TicketWithEmailContext | null> {
    return this.prisma.ticket.findUnique({
      where: { ticketId },
      include: {
        department: {
          include: {
            members: {
              include: { user: true },
            },
          },
        },
        submitter: true,
        agent: true,
      },
    });
  }

  private async findHandoff(
    handoffId: string,
  ): Promise<HandoffWithEmailContext | null> {
    return this.prisma.handoffRequest.findUnique({
      where: { handoffId },
      include: {
        requester: true,
        requestedAgent: true,
        ticket: {
          include: {
            department: {
              include: {
                members: {
                  include: { user: true },
                },
              },
            },
            submitter: true,
            agent: true,
          },
        },
      },
    });
  }

  private ticketContext(ticket: TicketWithEmailContext): TicketEmailContext {
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

  private handoffContext(
    handoff: HandoffWithEmailContext,
  ): HandoffEmailContext {
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
    ticket: TicketWithEmailContext,
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
  ): Promise<void> {
    const uniqueRecipients = new Map<string, EmailRecipient>();
    for (const recipient of recipients) {
      if (!this.isValidEmail(recipient.email)) continue;
      uniqueRecipients.set(recipient.email.toLowerCase(), recipient);
    }
    for (const recipient of uniqueRecipients.values()) {
      await this.sendWithRetry({ ...template, to: recipient });
    }
  }

  private async sendWithRetry(message: {
    to: EmailRecipient;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        await this.provider.send(message);
        return;
      } catch (error) {
        if (!this.isTransient(error) || attempt === this.maxAttempts) {
          this.logger.warn(
            `Email delivery failed after attempt ${attempt} (${this.describeError(error)}).`,
          );
          return;
        }
        await this.delay(this.retryDelayMs * 2 ** (attempt - 1));
      }
    }
  }

  private async runSafely(
    label: string,
    operation: () => Promise<void>,
  ): Promise<void> {
    try {
      await operation();
    } catch {
      this.logger.warn(`Email notification for ${label} was dropped.`);
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

  private describeError(error: unknown): string {
    if (!error || typeof error !== 'object') return 'unknown error';
    const details: string[] = [];
    const code = (error as { code?: unknown }).code;
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    const responseCode = (error as { responseCode?: unknown }).responseCode;
    const command = (error as { command?: unknown }).command;
    if (typeof code === 'string' && code) details.push(`code=${code}`);
    if (typeof statusCode === 'number')
      details.push(`statusCode=${statusCode}`);
    if (typeof responseCode === 'number')
      details.push(`responseCode=${responseCode}`);
    if (typeof command === 'string' && command)
      details.push(`command=${command}`);
    return details.join(', ') || 'unknown error';
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
    } catch {
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
}
