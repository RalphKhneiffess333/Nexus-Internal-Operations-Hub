import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';
import { sanitizePlainText } from '../../common/sanitization/content-sanitizer';

const sanitize = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? sanitizePlainText(value) : value;

export class SubmitTicketDto {
  @IsString()
  @Transform(sanitize)
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @Transform(sanitize)
  @IsNotEmpty()
  @MaxLength(10000)
  description!: string;

  @IsString()
  @Transform(sanitize)
  @IsNotEmpty()
  @Length(1, 40)
  priority!: string;

  @IsString()
  @Transform(sanitize)
  @IsNotEmpty()
  @MaxLength(100)
  departmentId!: string;
}
