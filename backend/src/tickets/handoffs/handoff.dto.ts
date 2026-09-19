import { HandoffStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class CreateHandoffDto {
  @IsString()
  @Length(1, 100)
  requestedAgentId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  message?: string;
}

export class HandoffQueryDto {
  @IsOptional()
  @IsEnum(HandoffStatus)
  status?: HandoffStatus;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  ticketId?: string;
}
