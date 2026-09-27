import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { NodemailerEmailProvider } from '../notifications/nodemailer-email.provider';
import type {
  DependencyHealth,
  DependencyStatus,
  HealthReport,
} from './health.types';

const MICROSOFT_OPENID_CONFIGURATION_URL =
  'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration';
const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models';
const DEFAULT_TIMEOUT_MS = 5000;

@Injectable()
export class HealthService {
  private readonly version = readBackendVersion();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailProvider: NodemailerEmailProvider,
  ) {}

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
      this.checkDependency(() => this.checkDatabase()),
      this.checkDependency(() => this.checkMicrosoftAuth()),
      this.checkDependency(() => this.emailProvider.checkHealth()),
      this.checkDependency(() => this.checkGroq()),
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

    const response = await fetch(MICROSOFT_OPENID_CONFIGURATION_URL, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
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
    check: () => Promise<Exclude<DependencyStatus, 'down'>>,
  ): Promise<DependencyHealth> {
    const startedAt = Date.now();
    try {
      const status = await check();
      return { status, latencyMs: Date.now() - startedAt };
    } catch {
      return { status: 'down', latencyMs: Date.now() - startedAt };
    }
  }

  private isMicrosoftAuthConfigured(): boolean {
    return [
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
}

function readBackendVersion(): string {
  try {
    const packageJsonPath = resolve(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      version?: unknown;
    };
    return typeof packageJson.version === 'string'
      ? packageJson.version
      : 'unknown';
  } catch {
    return 'unknown';
  }
}
