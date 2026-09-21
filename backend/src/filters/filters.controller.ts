import { Controller, Get, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../authorization/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../authentication/request-user';
import { FilterOptionsService } from './filter-options.service';

@Controller('filters')
@Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
export class FiltersController {
  constructor(private readonly filterOptionsService: FilterOptionsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.filterOptionsService.listForUser(request.user!);
  }
}
