import { IsOptional, IsString, Length } from 'class-validator';

export class CreateChatMessageDto {
  @IsOptional()
  @IsString()
  @Length(1, 4000)
  content?: string;
}
