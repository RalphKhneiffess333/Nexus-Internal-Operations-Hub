import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../authorization/decorators/roles.decorator';
import { PrioritiesService } from './priorities.service';

@Controller('priorities')
@Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
export class PrioritiesController {
  constructor(private readonly prioritiesService: PrioritiesService) {}

  @Get()
  list() {
    return this.prioritiesService.list(true);
  }
}
