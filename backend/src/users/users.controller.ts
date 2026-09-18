import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../authorization/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../authentication/request-user';
import {
  CreateAdminUserDto,
  PageQueryDto,
  UpdateRoleDto,
  UpdateStatusDto,
} from '../administration/dto/admin.dto';
import { UsersService } from './users.service';

@Controller('admin/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.Admin)
  list(@Query() query: PageQueryDto) {
    return this.usersService.listForAdministration(query);
  }

  @Post()
  @Roles(UserRole.Admin)
  create(@Body() dto: CreateAdminUserDto, @Req() req: AuthenticatedRequest) {
    return this.usersService.preProvision(dto, req.user!);
  }

  @Get(':userId')
  @Roles(UserRole.Admin)
  findOne(@Param('userId') userId: string) {
    return this.usersService.findForAdministration(userId);
  }

  @Patch(':userId/role')
  @Roles(UserRole.Admin)
  changeRole(
    @Param('userId') userId: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.mapRole(userId, dto, req.user!);
  }

  @Patch(':userId/status')
  @Roles(UserRole.Admin)
  changeStatus(
    @Param('userId') userId: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.setActive(userId, dto, req.user!);
  }
}
