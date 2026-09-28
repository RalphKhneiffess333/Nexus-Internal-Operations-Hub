import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { sanitizePlainText } from '../../common/sanitization/content-sanitizer';

export class CreateChatMessageDto {
  @IsOptional()
  @IsUUID('4')
  clientMessageId?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? sanitizePlainText(value) : value,
  )
  @IsNotEmpty()
  @Length(1, 4000)
  content?: string;
}
