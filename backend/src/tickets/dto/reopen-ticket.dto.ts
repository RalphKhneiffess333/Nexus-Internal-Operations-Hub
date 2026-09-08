import { IsOptional, IsString } from 'class-validator';

export class ReopenTicketDto {
  @IsOptional()
  @IsString()
  description?: string;
}
