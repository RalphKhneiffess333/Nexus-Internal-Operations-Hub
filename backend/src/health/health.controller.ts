import { Controller, Get, Headers, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../authorization/decorators/public.decorator';
import { HealthService } from './health.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('ping')
  ping() {
    return { status: 'ok' };
  }

  @Get()
  async getHealth(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!this.healthService.isConfigured()) {
      response.status(503);
      return {
        statusCode: 503,
        message:
          'Health check endpoint is disabled because HEALTH_CHECK_SECRET is not configured',
      };
    }

    if (!this.healthService.isAuthorized(authorization)) {
      response.status(401);
      return {
        statusCode: 401,
        message: 'Invalid health check credentials',
      };
    }

    const report = await this.healthService.getReport();
    if (report.status === 'unhealthy') {
      response.status(503);
    }
    return report;
  }
}
