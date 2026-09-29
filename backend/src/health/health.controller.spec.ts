import { describe, expect, it, jest } from '@jest/globals';
import type { Response } from 'express';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  it('reports when the detailed health endpoint is disabled', async () => {
    const healthService = {
      isConfigured: jest.fn().mockReturnValue(false),
      isAuthorized: jest.fn(),
      getReport: jest.fn(),
    };
    const response = { status: jest.fn() } as unknown as Response;
    const controller = new HealthController(
      healthService as unknown as HealthService,
    );

    await expect(controller.getHealth(undefined, response)).resolves.toEqual({
      statusCode: 503,
      message:
        'Health check endpoint is disabled because HEALTH_CHECK_SECRET is not configured',
    });
    expect(response.status).toHaveBeenCalledWith(503);
    expect(healthService.isAuthorized).not.toHaveBeenCalled();
    expect(healthService.getReport).not.toHaveBeenCalled();
  });

  it('rejects invalid health credentials without exposing diagnostics', async () => {
    const healthService = {
      isConfigured: jest.fn().mockReturnValue(true),
      isAuthorized: jest.fn().mockReturnValue(false),
      getReport: jest.fn(),
    };
    const response = { status: jest.fn() } as unknown as Response;
    const controller = new HealthController(
      healthService as unknown as HealthService,
    );

    await expect(
      controller.getHealth('Bearer wrong-secret', response),
    ).resolves.toEqual({
      statusCode: 401,
      message: 'Invalid health check credentials',
    });
    expect(response.status).toHaveBeenCalledWith(401);
  });
});
