import {
  Controller,
  Get,
  Headers,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
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
    if (!this.healthService.isAuthorized(authorization)) {
      throw new UnauthorizedException('Invalid health check credentials');
    }

    const report = await this.healthService.getReport();
    if (report.status === 'unhealthy') {
      response.status(503);
    }
    return report;
  }
}
