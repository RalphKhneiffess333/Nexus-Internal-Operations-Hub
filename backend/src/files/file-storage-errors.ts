import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

export type FileStorageOperation =
  'store' | 'read' | 'delete' | 'exists' | 'list';

export function throwFileStorageError(
  error: unknown,
  operation: FileStorageOperation,
): never {
  if (error instanceof HttpException) {
    throw error;
  }

  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  if (operation === 'read' && code === 'ENOENT') {
    throw new NotFoundException('Attachment file was not found');
  }

  throw new InternalServerErrorException('File storage operation failed');
}

export function invalidStorageKey(message: string): BadRequestException {
  return new BadRequestException(message);
}
