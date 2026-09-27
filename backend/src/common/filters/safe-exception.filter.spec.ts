import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import type { Response } from 'express';
import { SafeExceptionFilter } from './safe-exception.filter';

describe('SafeExceptionFilter', () => {
  function responseFor(filter: SafeExceptionFilter) {
    const json = jest.fn();
    const response = {
      status: jest.fn().mockReturnValue({ json }),
    } as unknown as Response;
    const request = {
      method: 'POST',
      originalUrl: '/ai/messages',
      url: '/ai/messages',
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;

    return { json, response, request, host, filter };
  }

  it('hides string details from 5xx HttpExceptions', () => {
    const context = responseFor(new SafeExceptionFilter());

    context.filter.catch(
      new HttpException(
        'Prisma connection failed: secret database details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ),
      context.host,
    );

    expect(context.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
    });
  });

  it('hides object and array details from 5xx HttpExceptions', () => {
    const context = responseFor(new SafeExceptionFilter());

    context.filter.catch(
      new HttpException(
        {
          message: ['filesystem path leaked', 'provider token leaked'],
        },
        HttpStatus.BAD_GATEWAY,
      ),
      context.host,
    );

    expect(context.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_GATEWAY,
      message: 'An unexpected error occurred',
    });
  });

  it('preserves client-safe 4xx messages', () => {
    const context = responseFor(new SafeExceptionFilter());

    context.filter.catch(
      new HttpException('Ticket was not found', HttpStatus.NOT_FOUND),
      context.host,
    );

    expect(context.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      message: 'Ticket was not found',
    });
  });

  it('logs server-side failures with request context and keeps the response safe', () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const context = responseFor(new SafeExceptionFilter());

    context.filter.catch(new Error('database connection failed'), context.host);

    const loggedRecord = JSON.parse(
      String(loggerSpy.mock.calls[0]?.[0]),
    ) as Record<string, unknown>;
    expect(loggedRecord).toMatchObject({
      event: 'system_error',
      operation: 'http.request',
      object: { type: 'http-request', id: 'POST unknown' },
      context: { method: 'POST', path: '/ai/messages', status: 500 },
      error: { name: 'Error', message: 'database connection failed' },
    });
    expect(typeof loggedRecord.timestamp).toBe('string');
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
    );
    expect(context.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
    });
    loggerSpy.mockRestore();
  });
});
