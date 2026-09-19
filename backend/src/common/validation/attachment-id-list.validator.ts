import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const attachmentIdentifierPattern = /^[A-Za-z0-9_-]+$/;

@ValidatorConstraint({ name: 'attachmentIdListJson', async: false })
export class AttachmentIdListJsonConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;

    try {
      const parsed: unknown = JSON.parse(value);
      return (
        Array.isArray(parsed) &&
        parsed.length <= 20 &&
        parsed.every(
          (attachmentId) =>
            typeof attachmentId === 'string' &&
            attachmentId === attachmentId.trim() &&
            attachmentId.length > 0 &&
            attachmentId.length <= 100 &&
            attachmentIdentifierPattern.test(attachmentId),
        )
      );
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'removedAttachmentIds must be a JSON array of at most 20 valid identifiers';
  }
}

export function IsAttachmentIdListJson(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    registerDecorator({
      name: 'attachmentIdListJson',
      target: target.constructor,
      propertyName: propertyKey.toString(),
      options: validationOptions,
      validator: AttachmentIdListJsonConstraint,
    });
  };
}
