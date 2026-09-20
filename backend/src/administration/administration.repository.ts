import { HttpException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mapPrismaError } from '../database/prisma-error';
import { PrismaService } from '../database/prisma.service';

export type AdministrationPersistenceClient =
  | PrismaService
  | Prisma.TransactionClient;

const departmentListInclude = {
  _count: { select: { members: true, tickets: true } },
} satisfies Prisma.DepartmentInclude;

const departmentMemberListSelect = {
  user: {
    select: {
      userId: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
    },
  },
} satisfies Prisma.DepartmentMemberSelect;

export type DepartmentListRecord = Prisma.DepartmentGetPayload<{
  include: typeof departmentListInclude;
}>;

export type DepartmentMemberListRecord = Prisma.DepartmentMemberGetPayload<{
  select: typeof departmentMemberListSelect;
}>;

export type ConfigurationRecord = Prisma.SystemConfigurationGetPayload<{
  select: {
    configurationId: true;
    key: true;
    value: true;
    description: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

@Injectable()
export class AdministrationRepository {
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

  async listDepartments(
    search: string | undefined,
    skip: number,
    take: number,
    excludeCode: string,
  ): Promise<{ items: DepartmentListRecord[]; total: number }> {
    const where: Prisma.DepartmentWhereInput = {
      code: { not: excludeCode },
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    try {
      const [items, total] = await this.prisma.$transaction([
        this.prisma.department.findMany({
          where,
          orderBy: { name: 'asc' },
          skip,
          take,
          include: departmentListInclude,
        }),
        this.prisma.department.count({ where }),
      ]);
      return { items, total };
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async createDepartment(
    code: string,
    name: string,
    description: string,
    client: Prisma.TransactionClient,
  ) {
    try {
      return await client.department.create({
        data: {
          departmentId: randomUUID(),
          code,
          name,
          desc: description,
          active: true,
        },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findDepartment(
    departmentId: string,
    client: AdministrationPersistenceClient = this.prisma,
  ) {
    try {
      return await client.department.findUnique({ where: { departmentId } });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async updateDepartment(
    departmentId: string,
    data: { code?: string; name?: string; description?: string },
    client: Prisma.TransactionClient,
  ) {
    try {
      return await client.department.update({
        where: { departmentId },
        data: {
          ...(data.code === undefined ? {} : { code: data.code }),
          ...(data.name === undefined ? {} : { name: data.name }),
          ...(data.description === undefined ? {} : { desc: data.description }),
        },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findDepartmentWithActiveTicket(
    departmentId: string,
    client: Prisma.TransactionClient,
  ) {
    try {
      return await client.department.findUnique({
        where: { departmentId },
        include: {
          tickets: {
            where: { active: true },
            select: { ticketId: true },
            take: 1,
          },
        },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async setDepartmentActive(
    departmentId: string,
    active: boolean,
    client: Prisma.TransactionClient,
  ) {
    try {
      return await client.department.update({
        where: { departmentId },
        data: { active },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async listMembers(
    departmentId: string,
    search: string | undefined,
    skip: number,
    take: number,
  ): Promise<{ items: DepartmentMemberListRecord[]; total: number }> {
    const trimmedSearch = search?.trim();
    const where: Prisma.DepartmentMemberWhereInput = {
      departmentId,
      ...(trimmedSearch
        ? {
            user: {
              OR: [
                { fullName: { contains: trimmedSearch, mode: 'insensitive' } },
                { email: { contains: trimmedSearch, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    try {
      const [items, total] = await this.prisma.$transaction([
        this.prisma.departmentMember.findMany({
          where,
          select: departmentMemberListSelect,
          orderBy: { user: { fullName: 'asc' } },
          skip,
          take,
        }),
        this.prisma.departmentMember.count({ where }),
      ]);
      return { items, total };
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async listConfigurations(keys: string[]): Promise<ConfigurationRecord[]> {
    try {
      return await this.prisma.systemConfiguration.findMany({
        where: { key: { in: keys } },
        orderBy: { key: 'asc' },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findConfiguration(key: string, client: Prisma.TransactionClient) {
    try {
      return await client.systemConfiguration.findUnique({ where: { key } });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async updateConfiguration(
    key: string,
    value: string,
    client: Prisma.TransactionClient,
  ) {
    try {
      return await client.systemConfiguration.update({
        where: { key },
        data: { value },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }
}
