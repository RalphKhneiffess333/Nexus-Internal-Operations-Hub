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
import {
  type FailedObject,
  logSystemError,
} from '../logging/system-error.logger';

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
      logSystemError(this.logger, this.loggableException(exception), {
        operation: 'http.request',
        object: this.failedObject(request),
        context: { method, path, status },
      });
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

  private failedObject(request: Request | undefined): FailedObject {
    const identifier = Object.entries(request?.params ?? {}).find(
      ([key, value]) => key.endsWith('Id') && typeof value === 'string',
    );
    if (identifier) {
      return {
        type: identifier[0].slice(0, -2) || 'resource',
        id: identifier[1] as string,
      };
    }

    return {
      type: 'http-request',
      id: `${request?.method ?? 'UNKNOWN'} ${request?.path ?? 'unknown'}`,
    };
  }

  private loggableException(exception: unknown): unknown {
    if (!(exception instanceof HttpException)) return exception;

    const safeException = new Error('HTTP exception');
    safeException.name = exception.name;
    if (exception.cause) safeException.cause = exception.cause;
    return safeException;
  }
}
