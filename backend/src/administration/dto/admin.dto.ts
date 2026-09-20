import {
  IsBoolean,
  IsBooleanString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { UserRole } from '@prisma/client';
import { sanitizePlainText } from '../../common/sanitization/content-sanitizer';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const sanitize = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? sanitizePlainText(value) : value;

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;

  @IsOptional()
  @IsString()
  @Transform(sanitize)
  @IsNotEmpty()
  @Length(1, 100)
  search?: string;
}

export class AdminUserQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(['active', 'inactive'] as const)
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsString()
  @Transform(sanitize)
  @IsNotEmpty()
  @Length(1, 100)
  departmentId?: string;

  @IsOptional()
  @IsBooleanString()
  hasLogged?: string;
}

export class CreateAdminUserDto {
  @Transform(sanitize)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Transform(sanitize)
  @IsNotEmpty()
  @Length(1, 200)
  fullName!: string;

  @IsOptional()
  @IsString()
  @Transform(sanitize)
  @IsNotEmpty()
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
  @Transform(sanitize)
  @IsNotEmpty()
  @Length(1, 30)
  code!: string;

  @IsString()
  @Transform(sanitize)
  @IsNotEmpty()
  @Length(1, 150)
  name!: string;

  @IsString()
  @Transform(sanitize)
  @IsNotEmpty()
  @Length(1, 1000)
  description!: string;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @Transform(trimString)
  @IsNotEmpty()
  @Length(1, 30)
  code?: string;

  @IsOptional()
  @IsString()
  @Transform(trimString)
  @IsNotEmpty()
  @Length(1, 150)
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(trimString)
  @IsNotEmpty()
  @Length(1, 1000)
  description?: string;
}

export class UpdateConfigurationDto {
  @IsString()
  @Transform(trimString)
  @IsNotEmpty()
  @Length(1, 100)
  @Matches(/^\d+$/)
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
    'PRIORITY_ADDITION',
    'PRIORITY_MODIFICATION',
    'PRIORITY_DELETION',
    'PRIORITY_REACTIVATION',
    'SYSTEM_VARIABLE_MODIFICATION',
  ] as const)
  action?: string;

  @IsOptional()
  @IsString()
  @Transform(trimString)
  @IsNotEmpty()
  @Length(1, 100)
  actorId?: string;
}
