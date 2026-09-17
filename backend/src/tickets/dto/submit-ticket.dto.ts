import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { TicketPriority } from '@prisma/client';

export class SubmitTicketDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsEnum(TicketPriority)
  priority!: TicketPriority;

  @IsString()
  @IsNotEmpty()
  departmentId!: string;
}
