import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from '@nestjs/common';

const identifierPattern = /^[A-Za-z0-9_-]+$/;

export class IdentifierValidationPipe implements PipeTransform<
  unknown,
  string
> {
  transform(value: unknown, metadata: ArgumentMetadata): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(
        `${metadata.data ?? 'identifier'} must be a valid identifier`,
      );
    }

    const identifier = value.trim();
    if (
      !identifier ||
      identifier.length > 100 ||
      !identifierPattern.test(identifier)
    ) {
      throw new BadRequestException(
        `${metadata.data ?? 'identifier'} must be a valid identifier`,
      );
    }

    return identifier;
  }
}
