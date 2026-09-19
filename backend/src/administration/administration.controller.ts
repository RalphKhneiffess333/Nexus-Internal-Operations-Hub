import {
  Body,
  Controller,
  Delete,
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
import { IdentifierValidationPipe } from '../common/pipes/identifier-validation.pipe';
import { AdministrationService } from './administration.service';
import {
  CreateDepartmentDto,
  PageQueryDto,
  UpdateConfigurationDto,
  UpdateDepartmentDto,
} from './dto/admin.dto';

@Controller('admin')
@Roles(UserRole.Admin)
export class AdministrationController {
  constructor(private readonly administrationService: AdministrationService) {}

  @Get('departments') listDepartments(@Query() query: PageQueryDto) {
    return this.administrationService.listDepartments(query);
  }
  @Post('departments') createDepartment(
    @Body() dto: CreateDepartmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.administrationService.createDepartment(dto, req.user!);
  }
  @Patch('departments/:departmentId') updateDepartment(
    @Param('departmentId', IdentifierValidationPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.administrationService.updateDepartment(id, dto, req.user!);
  }
  @Delete('departments/:departmentId') deactivateDepartment(
    @Param('departmentId', IdentifierValidationPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.administrationService.setDepartmentActive(id, false, req.user!);
  }
  @Post('departments/:departmentId/reactivate') reactivateDepartment(
    @Param('departmentId', IdentifierValidationPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.administrationService.setDepartmentActive(id, true, req.user!);
  }
  @Get('departments/:departmentId/members') listMembers(
    @Param('departmentId', IdentifierValidationPipe) id: string,
  ) {
    return this.administrationService.listMembers(id);
  }

  @Get('configurations') listConfigurations() {
    return this.administrationService.listConfigurations();
  }
  @Patch('configurations/:key') updateConfiguration(
    @Param('key', IdentifierValidationPipe) key: string,
    @Body() dto: UpdateConfigurationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.administrationService.updateConfiguration(key, dto, req.user!);
  }
}
