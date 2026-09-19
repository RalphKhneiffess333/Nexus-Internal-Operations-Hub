import { Controller, Get, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedRequest } from '../authentication/request-user';
import { Roles } from '../authorization/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  getSummary(@Req() request: AuthenticatedRequest) {
    return this.dashboardService.getSummary(request.user!);
  }
}
