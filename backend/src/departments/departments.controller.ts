import { Controller, Get, Query, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../authorization/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../authentication/request-user';
import { DepartmentsService } from './departments.service';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query('scope') scope?: string,
  ) {
    return this.departmentsService.findAll(
      request.user!,
      scope === 'mine' ? 'mine' : 'all',
    );
  }
}
