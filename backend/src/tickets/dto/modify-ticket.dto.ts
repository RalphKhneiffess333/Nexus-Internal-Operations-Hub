import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TicketPriority } from '@prisma/client';

export class ModifyTicketDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsString()
  departmentId?: string;
}
