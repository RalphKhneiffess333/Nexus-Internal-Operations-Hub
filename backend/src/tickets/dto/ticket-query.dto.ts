import { TicketPriority, TicketStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class TicketQueryDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  departmentId?: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;
}
