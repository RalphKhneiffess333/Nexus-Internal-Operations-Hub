import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { mapPrismaError } from '../../database/prisma-error';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { userId },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }
}
