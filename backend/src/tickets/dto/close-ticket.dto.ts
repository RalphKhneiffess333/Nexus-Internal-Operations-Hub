import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { sanitizePlainText } from '../../common/sanitization/content-sanitizer';

export class CloseTicketDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? sanitizePlainText(value) : value,
  )
  @IsNotEmpty()
  @MaxLength(10000)
  completionNotes?: string;
}
