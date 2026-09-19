import { TicketEventAction } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

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
  @IsEnum(auditActions)
  action?: (typeof auditActions)[number];

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @Length(1, 100)
  actorId?: string;
}

export class TicketEventsQueryDto {
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
  pageSize = 100;

  @IsOptional()
  @IsEnum(TicketEventAction)
  action?: TicketEventAction;
}
