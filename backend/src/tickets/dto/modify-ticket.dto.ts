import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TicketPriority } from '../../common/enums/ticket-priority.enum';

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
