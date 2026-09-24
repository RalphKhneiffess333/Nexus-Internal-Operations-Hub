import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Response } from 'express';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SafeExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<Request>();
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = this.safeMessage(exceptionResponse, status);

    if (status >= 500) {
      const method = request?.method ?? 'UNKNOWN';
      const path = request?.originalUrl ?? request?.url ?? 'unknown path';
      const errorName =
        exception instanceof Error ? exception.name : 'UnhandledException';
      const errorMessage =
        exception instanceof HttpException
          ? 'HTTP exception'
          : exception instanceof Error
            ? exception.message
            : String(exception);
      this.logger.error(
        `${method} ${path} -> ${status} ${errorName}: ${errorMessage}`,
        exception instanceof HttpException
          ? undefined
          : exception instanceof Error
            ? exception.stack
            : undefined,
      );
    }
    response.status(status).json({ statusCode: status, message });
  }

  private safeMessage(
    response: string | object | undefined,
    status: number,
  ): string | string[] {
    if (status >= 500) return 'An unexpected error occurred';
    if (typeof response === 'string') return response;
    if (response && 'message' in response) {
      const message = (response as { message?: unknown }).message;
      if (typeof message === 'string' || Array.isArray(message)) return message;
    }
    return 'Request failed';
  }
}
