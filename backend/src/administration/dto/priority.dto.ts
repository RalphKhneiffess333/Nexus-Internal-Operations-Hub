import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { sanitizePlainText } from '../../common/sanitization/content-sanitizer';

const sanitize = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? sanitizePlainText(value) : value;

export class CreatePriorityDto {
  @IsString()
  @Transform(sanitize)
  @IsNotEmpty()
  @Length(1, 40)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
  code!: string;

  @IsString()
  @Transform(sanitize)
  @IsNotEmpty()
  @Length(1, 100)
  name!: string;

  @IsInt()
  @Min(0)
  @Max(525600)
  reminderIntervalMinutes!: number;
}

export class UpdatePriorityDto {
  @IsOptional()
  @IsString()
  @Transform(sanitize)
  @IsNotEmpty()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(525600)
  reminderIntervalMinutes?: number;
}
