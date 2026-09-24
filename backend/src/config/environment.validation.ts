import { BadRequestException } from '@nestjs/common';

const positiveIntegerKeys = [
  'PORT',
  'SMTP_PORT',
  'SMTP_TIMEOUT_MS',
  'EMAIL_MAX_ATTEMPTS',
  'EMAIL_RETRY_DELAY_MS',
  'ORPHANED_FILE_CLEANUP_INTERVAL_MS',
  'AUDIT_LOG_CLEANUP_INTERVAL_MS',
  'UNCLAIMED_TICKET_REMINDER_INTERVAL_MS',
  'FILE_ORPHAN_GRACE_PERIOD_MS',
  'AI_RETRY_DELAY_MS',
] as const;

const booleanKeys = [
  'SMTP_SECURE',
  'SMTP_ENABLED',
  'BACKGROUND_WORKERS_ENABLED',
] as const;

/** Validates optional runtime settings while preserving each feature's defaults. */
export function validateEnvironment(config: Record<string, unknown>) {
  for (const key of positiveIntegerKeys) {
    const value = config[key];
    if (value === undefined || value === '') continue;
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) {
      throw new BadRequestException(`${key} must be a positive integer`);
    }
  }

  for (const key of booleanKeys) {
    const value = config[key];
    if (value === undefined || value === '') continue;
    if (value !== 'true' && value !== 'false') {
      throw new BadRequestException(`${key} must be either true or false`);
    }
  }

  for (const key of ['FRONTEND_URL', 'APP_BASE_URL'] as const) {
    const value = config[key];
    if (typeof value !== 'string' || !value.trim()) continue;
    try {
      new URL(value);
    } catch {
      throw new BadRequestException(`${key} must be a valid URL`);
    }
  }

  return config;
}
