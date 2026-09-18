import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export const auditActions = [
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
] as const;

export class AuditQueryDto {
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
  @IsEnum(auditActions)
  action?: (typeof auditActions)[number];

  @IsOptional()
  @IsUUID()
  actorId?: string;
}
