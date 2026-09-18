import { Controller, Get, Param } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../authorization/decorators/roles.decorator';
import { UsersService } from './users.service';

@Controller('users')
export class UserProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':userId')
  @Roles(UserRole.Employee, UserRole.Agent, UserRole.Admin)
  findOne(@Param('userId') userId: string) {
    return this.usersService.findForProfile(userId);
  }
}
