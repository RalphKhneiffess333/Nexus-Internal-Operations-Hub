import { describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { NodemailerEmailProvider } from '../notifications/nodemailer-email.provider';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports whether the detailed health endpoint is configured', () => {
    const configured = createService().service;
    const disabled = createService({ HEALTH_CHECK_SECRET: '' }).service;

    expect(configured.isConfigured()).toBe(true);
    expect(disabled.isConfigured()).toBe(false);
  });

  it('accepts only the configured bearer secret', () => {
    const { service } = createService();

    expect(service.isAuthorized('Bearer health-secret')).toBe(true);
    expect(service.isAuthorized('Bearer wrong-secret')).toBe(false);
    expect(service.isAuthorized(undefined)).toBe(false);
  });

  it('reports healthy dependencies without sending email or generating AI output', async () => {
    const { service, fetchMock, prisma, emailProvider } = createService({
      GROQ_API_KEY: '',
    });
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

    const report = await service.getReport();

    expect(report.status).toBe('healthy');
    expect(report.services.database.status).toBe('healthy');
    expect(report.services.microsoftAuth.status).toBe('healthy');
    expect(report.services.email.status).toBe('healthy');
    expect(report.services.groq.status).toBe('disabled');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(emailProvider.checkHealth).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports unhealthy when a required dependency is down', async () => {
    const { service, fetchMock } = createService({
      GROQ_API_KEY: '',
      databaseError: new Error('database unavailable'),
    });
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

    const report = await service.getReport();

    expect(report.status).toBe('unhealthy');
    expect(report.services.database.status).toBe('down');
  });
});

function createService(overrides: Record<string, string | Error> = {}): {
  service: HealthService;
  fetchMock: jest.Mock;
  prisma: { $queryRaw: jest.Mock };
  emailProvider: { checkHealth: jest.Mock };
} {
  const values: Record<string, string> = {
    HEALTH_CHECK_SECRET: 'health-secret',
    HEALTH_CHECK_TIMEOUT_MS: '1000',
    MICROSOFT_ENTRA_TENANT_ID: 'organization-tenant-id',
    MICROSOFT_ENTRA_CLIENT_ID: 'client-id',
    MICROSOFT_ENTRA_CLIENT_SECRET: 'client-secret',
    MICROSOFT_ENTRA_REDIRECT_URI: 'http://localhost:3000/callback',
    GROQ_API_KEY: 'groq-key',
  };
  const databaseError = overrides.databaseError;
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === 'string') values[key] = value;
  }

  const fetchMock = jest.fn();
  global.fetch = fetchMock as typeof fetch;
  const prisma = {
    $queryRaw: databaseError
      ? jest.fn().mockRejectedValue(databaseError)
      : jest.fn().mockResolvedValue([{ ok: 1 }]),
  };
  const emailProvider = {
    checkHealth: jest.fn().mockResolvedValue('healthy'),
  };
  const config = {
    get: jest.fn((key: string) => values[key]),
  };

  return {
    service: new HealthService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      emailProvider as unknown as NodemailerEmailProvider,
    ),
    fetchMock,
    prisma,
    emailProvider,
  };
}
