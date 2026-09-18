import { Controller, Get, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../authorization/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../authentication/request-user';
import { DepartmentsService } from './departments.service';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Roles(UserRole.Agent, UserRole.Admin)
  @Get('mine')
  findMine(@Req() request: AuthenticatedRequest) {
    return this.departmentsService.findMine(request.user!.userId);
  }

  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  @Get()
  findAll() {
    return this.departmentsService.findAll();
  }
}
