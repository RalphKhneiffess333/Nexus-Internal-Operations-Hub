import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../authorization/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../authentication/request-user';
import { AdministrationService } from './administration.service';
import { AuditQueryDto, CreateAdminUserDto, CreateDepartmentDto, PageQueryDto, UpdateConfigurationDto, UpdateDepartmentDto, UpdateRoleDto, UpdateStatusDto } from './dto/admin.dto';

@Controller('admin')
@Roles(UserRole.Admin)
export class AdministrationController {
  constructor(private readonly administrationService: AdministrationService) {}

  @Get('users') listUsers(@Query() query: PageQueryDto) { return this.administrationService.listUsers(query); }
  @Post('users') createUser(@Body() dto: CreateAdminUserDto, @Req() req: AuthenticatedRequest) { return this.administrationService.createUser(dto, req.user!); }
  @Get('users/:userId') getUser(@Param('userId') userId: string) { return this.administrationService.getUser(userId); }
  @Patch('users/:userId/role') changeRole(@Param('userId') userId: string, @Body() dto: UpdateRoleDto, @Req() req: AuthenticatedRequest) { return this.administrationService.changeRole(userId, dto, req.user!); }
  @Patch('users/:userId/status') changeStatus(@Param('userId') userId: string, @Body() dto: UpdateStatusDto, @Req() req: AuthenticatedRequest) { return this.administrationService.changeStatus(userId, dto, req.user!); }
  @Get('users/:userId/departments') userDepartments(@Param('userId') userId: string) { return this.administrationService.getUser(userId).then((user) => user.departments); }
  @Post('users/:userId/departments/:departmentId') addMembership(@Param('userId') userId: string, @Param('departmentId') departmentId: string, @Req() req: AuthenticatedRequest) { return this.administrationService.addMembership(userId, departmentId, req.user!); }
  @Delete('users/:userId/departments/:departmentId') removeMembership(@Param('userId') userId: string, @Param('departmentId') departmentId: string, @Req() req: AuthenticatedRequest) { return this.administrationService.removeMembership(userId, departmentId, req.user!); }

  @Get('departments') listDepartments(@Query() query: PageQueryDto) { return this.administrationService.listDepartments(query); }
  @Post('departments') createDepartment(@Body() dto: CreateDepartmentDto, @Req() req: AuthenticatedRequest) { return this.administrationService.createDepartment(dto, req.user!); }
  @Patch('departments/:departmentId') updateDepartment(@Param('departmentId') id: string, @Body() dto: UpdateDepartmentDto, @Req() req: AuthenticatedRequest) { return this.administrationService.updateDepartment(id, dto, req.user!); }
  @Delete('departments/:departmentId') deactivateDepartment(@Param('departmentId') id: string, @Req() req: AuthenticatedRequest) { return this.administrationService.setDepartmentActive(id, false, req.user!); }
  @Post('departments/:departmentId/reactivate') reactivateDepartment(@Param('departmentId') id: string, @Req() req: AuthenticatedRequest) { return this.administrationService.setDepartmentActive(id, true, req.user!); }
  @Get('departments/:departmentId/members') listMembers(@Param('departmentId') id: string) { return this.administrationService.listMembers(id); }

  @Get('configurations') listConfigurations() { return this.administrationService.listConfigurations(); }
  @Patch('configurations/:key') updateConfiguration(@Param('key') key: string, @Body() dto: UpdateConfigurationDto, @Req() req: AuthenticatedRequest) { return this.administrationService.updateConfiguration(key, dto, req.user!); }
  @Get('audit-logs') listAuditLogs(@Query() query: AuditQueryDto) { return this.administrationService.listAuditLogs(query); }
  @Get('audit-logs/:auditLogId') getAuditLog(@Param('auditLogId') id: string) { return this.administrationService.getAuditLog(id); }
}
