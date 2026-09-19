import { HttpException, Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { mapPrismaError } from '../../database/prisma-error';

export type UserPersistenceClient = PrismaService | Prisma.TransactionClient;

const adminUserInclude = {
  departmentMembers: { include: { department: true } },
} satisfies Prisma.UserInclude;

export type AdminUserRecord = Prisma.UserGetPayload<{
  include: typeof adminUserInclude;
}>;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async transaction<T>(
    operation: (client: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(operation);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      mapPrismaError(error);
    }
  }

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

  async findAdminPage(
    where: Prisma.UserWhereInput,
    skip: number,
    take: number,
  ): Promise<AdminUserRecord[]> {
    try {
      return await this.prisma.user.findMany({
        where,
        orderBy: { fullName: 'asc' },
        skip,
        take,
        include: adminUserInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async count(where: Prisma.UserWhereInput): Promise<number> {
    try {
      return await this.prisma.user.count({ where });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findAdminById(userId: string): Promise<AdminUserRecord | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { userId },
        include: adminUserInclude,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findByIdForUpdate(
    userId: string,
    client: UserPersistenceClient,
  ): Promise<User | null> {
    try {
      return await client.user.findUnique({ where: { userId } });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async createPreProvisioned(
    data: Prisma.UserCreateInput,
    client: UserPersistenceClient,
  ): Promise<User> {
    try {
      return await client.user.create({ data });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async updateWithClient(
    userId: string,
    data: Prisma.UserUpdateInput,
    client: UserPersistenceClient,
  ): Promise<User> {
    try {
      return await client.user.update({ where: { userId }, data });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async countActiveAdminsExcept(
    userId: string,
    client: UserPersistenceClient,
  ): Promise<number> {
    try {
      return await client.user.count({
        where: { role: 'Admin', isActive: true, NOT: { userId } },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findMembership(
    userId: string,
    departmentId: string,
    client: UserPersistenceClient,
  ) {
    try {
      return await client.departmentMember.findUnique({
        where: { userId_departmentId: { userId, departmentId } },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findDepartment(
    departmentId: string,
    client: UserPersistenceClient,
  ) {
    try {
      return await client.department.findUnique({ where: { departmentId } });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findMemberships(
    userId: string,
    client: UserPersistenceClient,
  ) {
    try {
      return await client.departmentMember.findMany({ where: { userId } });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async deleteMemberships(
    userId: string,
    client: UserPersistenceClient,
  ): Promise<void> {
    try {
      await client.departmentMember.deleteMany({ where: { userId } });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async upsertMembership(
    userId: string,
    departmentId: string,
    client: UserPersistenceClient,
  ) {
    try {
      return await client.departmentMember.upsert({
        where: { userId_departmentId: { userId, departmentId } },
        create: { departmentMemberId: randomUUID(), userId, departmentId },
        update: {},
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async deleteMembership(
    userId: string,
    departmentId: string,
    client: UserPersistenceClient,
  ): Promise<void> {
    try {
      await client.departmentMember.delete({
        where: { userId_departmentId: { userId, departmentId } },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }
}
