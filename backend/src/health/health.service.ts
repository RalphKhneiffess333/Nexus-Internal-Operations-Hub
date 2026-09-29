import { timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { NodemailerEmailProvider } from '../notifications/nodemailer-email.provider';
import { logSystemError } from '../common/logging/system-error.logger';
import type {
  DependencyHealth,
  DependencyStatus,
  HealthReport,
} from './health.types';

const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models';
const DEFAULT_TIMEOUT_MS = 5000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly version = this.readBackendVersion();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailProvider: NodemailerEmailProvider,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('HEALTH_CHECK_SECRET')?.trim(),
    );
  }

  isAuthorized(authorization: string | undefined): boolean {
    const expectedSecret = this.config
      .get<string>('HEALTH_CHECK_SECRET')
      ?.trim();
    const suppliedSecret = this.readBearerToken(authorization);
    if (!expectedSecret || !suppliedSecret) return false;

    const expected = Buffer.from(expectedSecret);
    const supplied = Buffer.from(suppliedSecret);
    return (
      expected.length === supplied.length && timingSafeEqual(expected, supplied)
    );
  }

  async getReport(): Promise<HealthReport> {
    const [database, microsoftAuth, email, groq] = await Promise.all([
      this.checkDependency('database', () => this.checkDatabase()),
      this.checkDependency('microsoft-entra', () => this.checkMicrosoftAuth()),
      this.checkDependency('smtp', () => this.emailProvider.checkHealth()),
      this.checkDependency('groq', () => this.checkGroq()),
    ]);

    const services = { database, microsoftAuth, email, groq };
    const isHealthy = Object.values(services).every(
      (service) => service.status !== 'down',
    );

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      version: this.version,
      services,
    };
  }

  private async checkDatabase(): Promise<'healthy'> {
    await this.prisma.$queryRaw`SELECT 1`;
    return 'healthy';
  }

  private async checkMicrosoftAuth(): Promise<'healthy'> {
    if (!this.isMicrosoftAuthConfigured()) {
      throw new Error('Microsoft authentication is not configured');
    }

    const tenantId = this.config
      .get<string>('MICROSOFT_ENTRA_TENANT_ID')
      ?.trim();
    const response = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(tenantId ?? '')}/v2.0/.well-known/openid-configuration`,
      {
        signal: AbortSignal.timeout(this.timeoutMs),
      },
    );
    if (!response.ok) {
      throw new Error(`Microsoft OpenID discovery returned ${response.status}`);
    }

    return 'healthy';
  }

  private async checkGroq(): Promise<'healthy' | 'disabled'> {
    const apiKey = this.config.get<string>('GROQ_API_KEY')?.trim();
    if (!apiKey) return 'disabled';

    const response = await fetch(GROQ_MODELS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Groq model listing returned ${response.status}`);
    }

    return 'healthy';
  }

  private async checkDependency(
    serviceId: string,
    check: () => Promise<Exclude<DependencyStatus, 'down'>>,
  ): Promise<DependencyHealth> {
    const startedAt = Date.now();
    try {
      const status = await check();
      return { status, latencyMs: Date.now() - startedAt };
    } catch (error) {
      logSystemError(this.logger, error, {
        operation: 'health.check',
        object: { type: 'external-service', id: serviceId },
      });
      return { status: 'down', latencyMs: Date.now() - startedAt };
    }
  }

  private isMicrosoftAuthConfigured(): boolean {
    return [
      'MICROSOFT_ENTRA_TENANT_ID',
      'MICROSOFT_ENTRA_CLIENT_ID',
      'MICROSOFT_ENTRA_CLIENT_SECRET',
      'MICROSOFT_ENTRA_REDIRECT_URI',
    ].every((key) => Boolean(this.config.get<string>(key)?.trim()));
  }

  private readBearerToken(
    authorization: string | undefined,
  ): string | undefined {
    const match = /^Bearer\s+(.+)$/i.exec(authorization?.trim() ?? '');
    return match?.[1]?.trim() || undefined;
  }

  private get timeoutMs(): number {
    const value = Number(this.config.get<string>('HEALTH_CHECK_TIMEOUT_MS'));
    return Number.isInteger(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
  }

  private readBackendVersion(): string {
    try {
      const packageJsonPath = [
        resolve(__dirname, '..', '..', 'package.json'),
        resolve(__dirname, '..', '..', '..', 'package.json'),
      ].find((candidate) => existsSync(candidate));
      if (!packageJsonPath) {
        throw new Error('Backend package.json could not be found');
      }
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        version?: unknown;
      };
      if (typeof packageJson.version !== 'string') {
        throw new Error('Backend package version is missing or invalid');
      }
      return packageJson.version;
    } catch (error) {
      logSystemError(this.logger, error, {
        operation: 'health.read-backend-version',
        object: { type: 'application', id: 'backend' },
      });
      return 'unknown';
    }
  }
}
