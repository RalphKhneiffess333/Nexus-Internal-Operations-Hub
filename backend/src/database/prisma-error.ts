import {
  ConflictException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function mapPrismaError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    throw new ServiceUnavailableException('Database is unavailable');
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new ConflictException('A record with this value already exists');
    }

    if (
      error.code === 'P1001' ||
      error.code === 'P1002' ||
      error.code === 'P1017'
    ) {
      throw new ServiceUnavailableException('Database is unavailable');
    }
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    throw new InternalServerErrorException(
      'The database operation could not be completed',
    );
  }

  throw new InternalServerErrorException(
    'The database operation could not be completed',
  );
}
