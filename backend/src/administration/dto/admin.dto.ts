import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class PageQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;
}

export class CreateAdminUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(1, 200)
  fullName!: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  phoneNumber?: string;

  @IsEnum(UserRole)
  role: UserRole = UserRole.Employee;
}

export class UpdateRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}

export class UpdateStatusDto {
  @IsBoolean()
  active!: boolean;
}

export class CreateDepartmentDto {
  @IsString()
  @Length(1, 30)
  code!: string;

  @IsString()
  @Length(1, 150)
  name!: string;

  @IsString()
  @Length(1, 1000)
  description!: string;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @Length(1, 30)
  code?: string;

  @IsOptional()
  @IsString()
  @Length(1, 150)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  description?: string;
}

export class UpdateConfigurationDto {
  @IsString()
  @Length(1, 100)
  value!: string;
}

export class AuditQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum([
    'USER_PREPROVISIONING',
    'ROLE_MAPPING',
    'USER_ACTIVATION',
    'USER_DEACTIVATION',
    'DEPARTMENT_ADDITION',
    'DEPARTMENT_MODIFICATION',
    'DEPARTMENT_DELETION',
    'DEPARTMENT_REACTIVATION',
    'DEPARTMENT_MAPPING',
    'SYSTEM_VARIABLE_MODIFICATION',
  ] as const)
  action?: string;

  @IsOptional()
  @IsUUID()
  actorId?: string;
}
