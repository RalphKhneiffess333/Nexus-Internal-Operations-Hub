import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { sanitizePlainText } from '../../common/sanitization/content-sanitizer';

const sanitize = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? sanitizePlainText(value) : value;

export class AssistantMessageDto {
  @IsString()
  @Transform(sanitize)
  @IsNotEmpty()
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  conversationId?: string;
}
