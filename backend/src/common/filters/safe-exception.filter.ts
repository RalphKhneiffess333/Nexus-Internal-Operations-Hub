import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SafeExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = this.safeMessage(exceptionResponse, status);

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : 'Unhandled exception',
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
