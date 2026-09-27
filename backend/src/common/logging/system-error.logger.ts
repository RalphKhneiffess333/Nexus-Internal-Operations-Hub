import type { LoggerService } from '@nestjs/common';

export type FailedObject = {
  type: string;
  id: string;
};

export type SystemErrorDetails = {
  operation: string;
  object: FailedObject;
  context?: Record<string, boolean | number | string | undefined>;
};

/**
 * Produces a single machine-readable server log record for unexpected failures.
 * Do not place secrets or request bodies in `context`.
 */
export function logSystemError(
  logger: Pick<LoggerService, 'error'>,
  error: unknown,
  details: SystemErrorDetails,
): void {
  const exception = toError(error);
  const cause = exception.cause;
  const rootCause = cause instanceof Error ? cause : undefined;

  logger.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'system_error',
      operation: details.operation,
      object: details.object,
      ...(details.context ? { context: compactContext(details.context) } : {}),
      error: {
        name: exception.name,
        message: safeText(exception.message),
        ...errorMetadata(error),
        ...(rootCause
          ? {
              cause: {
                name: rootCause.name,
                message: safeText(rootCause.message),
              },
            }
          : {}),
      },
    }),
    safeText(rootCause?.stack ?? exception.stack ?? ''),
  );
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);

  const details = errorMetadata(error);
  const message = Object.keys(details).length
    ? Object.entries(details)
        .map(([key, value]) => `${key}=${value}`)
        .join(', ')
    : String(error);
  return new Error(message);
}

function compactContext(
  context: Record<string, boolean | number | string | undefined>,
): Record<string, boolean | number | string> {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined),
  ) as Record<string, boolean | number | string>;
}

function errorMetadata(error: unknown): Record<string, number | string> {
  if (!error || typeof error !== 'object') return {};

  const record = error as Record<string, unknown>;
  const metadata: Record<string, number | string> = {};
  for (const key of ['code', 'statusCode', 'responseCode'] as const) {
    const value = record[key];
    if (typeof value === 'string' || typeof value === 'number') {
      metadata[key] = value;
    }
  }
  return metadata;
}

function safeText(value: string): string {
  return value
    .slice(0, 12000)
    .replace(/(bearer\s+)[^\s]+/gi, '$1[REDACTED]')
    .replace(
      /\b(password|secret|token|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi,
      '$1=[REDACTED]',
    )
    .replace(/:\/\/([^:\s]+):([^@\s]+)@/g, '://$1:[REDACTED]@');
}
