import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
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

  async findByEmail(email: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { email },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findByIdentity(
    identityProviderId: string,
    identityProviderUserId: string,
  ): Promise<User | null> {
    try {
      return await this.prisma.user.findFirst({
        where: {
          identityProviderId,
          identityProviderUserId,
        },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    try {
      return await this.prisma.user.create({ data });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async update(userId: string, data: Prisma.UserUpdateInput): Promise<User> {
    try {
      return await this.prisma.user.update({
        where: { userId },
        data,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findIdentityProviderByCode(code: string) {
    try {
      return await this.prisma.identityProvider.findFirst({
        where: { code },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }
}
