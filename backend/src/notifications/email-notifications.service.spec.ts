import { describe, expect, it, jest } from '@jest/globals';
import { TicketPriority, TicketStatus, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import type { EmailProvider } from './email-provider';
import { EmailNotificationsService } from './email-notifications.service';
import type { NotificationsRepository } from './notifications.repository';

function user(userId: string, email: string, role: UserRole, isActive = true) {
  return { userId, email, fullName: userId, role, isActive };
}

function ticket() {
  const submitter = user(
    'submitter',
    'submitter@company.com',
    UserRole.Employee,
  );
  return {
    ticketId: 'ticket-1',
    ticketCode: 'NEX-0001',
    title: 'Printer issue',
    status: TicketStatus.OPEN,
    priority: TicketPriority.MODERATE,
    completionNotes: null,
    submitter,
    agent: null,
    department: {
      name: 'IT',
      members: [
        { user: user('agent', 'agent@company.com', UserRole.Agent) },
        { user: user('admin', 'admin@company.com', UserRole.Admin) },
        {
          user: user('inactive', 'inactive@company.com', UserRole.Agent, false),
        },
        { user: user('employee', 'employee@company.com', UserRole.Employee) },
      ],
    },
  };
}

function setup() {
  const provider: jest.Mocked<EmailProvider> = {
    send: jest.fn<EmailProvider['send']>(),
  };
  const repository = {
    findTicket: jest.fn(),
    findHandoff: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        FRONTEND_URL: 'http://localhost:5173',
        EMAIL_MAX_ATTEMPTS: '3',
        EMAIL_RETRY_DELAY_MS: '1',
      };
      return values[key];
    }),
  };
  const service = new EmailNotificationsService(
    repository as unknown as NotificationsRepository,
    config as unknown as ConfigService,
    provider,
  );
  return { provider, repository, service };
}

describe('EmailNotificationsService', () => {
  it('emails active agents and administrators for a new ticket', async () => {
    const { provider, repository, service } = setup();
    repository.findTicket.mockResolvedValue(ticket() as never);

    await service.notifyTicketSubmitted('ticket-1', 'submitter');

    expect(provider.send.mock.calls).toHaveLength(2);
    expect(provider.send.mock.calls.map(([email]) => email.to.email)).toEqual([
      'agent@company.com',
      'admin@company.com',
    ]);
  });

  it('retries transient provider failures and drops permanent failures without retrying', async () => {
    const { provider, repository, service } = setup();
    repository.findTicket.mockResolvedValue(ticket() as never);
    provider.send
      .mockRejectedValueOnce({ statusCode: 503 })
      .mockRejectedValueOnce({ statusCode: 400 });

    await service.notifyTicketClaimed('ticket-1', 'agent');

    expect(provider.send.mock.calls).toHaveLength(2);
  });

  it('deduplicates handoff recipients while notifying the requester, recipient, and submitter', async () => {
    const { provider, repository, service } = setup();
    const baseTicket = ticket();
    repository.findHandoff.mockResolvedValue({
      handoffId: 'handoff-1',
      status: 'ACCEPTED',
      message: null,
      requester: user('agent', 'agent@company.com', UserRole.Agent),
      requestedAgent: user('admin', 'admin@company.com', UserRole.Admin),
      ticket: baseTicket,
    } as never);

    await service.notifyHandoffAccepted('handoff-1');

    expect(provider.send.mock.calls).toHaveLength(3);
    expect(provider.send.mock.calls.map(([email]) => email.to.email)).toEqual([
      'agent@company.com',
      'admin@company.com',
      'submitter@company.com',
    ]);
  });
});
