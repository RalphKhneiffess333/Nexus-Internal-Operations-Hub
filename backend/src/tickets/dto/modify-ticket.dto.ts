import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { IsAttachmentIdListJson } from '../../common/validation/attachment-id-list.validator';
import { sanitizePlainText } from '../../common/sanitization/content-sanitizer';

const sanitize = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? sanitizePlainText(value) : value;

export class ModifyTicketDto {
  @IsOptional()
  @IsString()
  @Transform(sanitize)
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @Transform(sanitize)
  @IsNotEmpty()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @IsString()
  @Transform(sanitize)
  @IsNotEmpty()
  @Length(1, 40)
  priority?: string;

  @IsOptional()
  @IsString()
  @Transform(sanitize)
  @IsNotEmpty()
  @Length(1, 100)
  departmentId?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsAttachmentIdListJson()
  @MaxLength(4000)
  removedAttachmentIds?: string;
}
