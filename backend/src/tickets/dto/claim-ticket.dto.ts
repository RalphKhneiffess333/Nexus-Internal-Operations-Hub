import { IsNotEmpty, IsString } from 'class-validator';

export class ClaimTicketDto {
  @IsString()
  @IsNotEmpty()
  agentId!: string;
}
