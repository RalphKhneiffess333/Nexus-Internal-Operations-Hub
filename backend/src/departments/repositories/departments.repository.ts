import { Injectable } from '@nestjs/common';
import { Department, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { mapPrismaError } from '../../database/prisma-error';

const departmentReferenceSelect = {
  departmentId: true,
  code: true,
  name: true,
  active: true,
} satisfies Prisma.DepartmentSelect;

@Injectable()
export class DepartmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(departmentId: string): Promise<Department | null> {
    try {
      return await this.prisma.department.findUnique({
        where: { departmentId },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findAllActive(excludeCode?: string): Promise<DepartmentReference[]> {
    try {
      return await this.prisma.department.findMany({
        where: {
          active: true,
          ...(excludeCode ? { code: { not: excludeCode } } : {}),
        },
        orderBy: { name: 'asc' },
        select: departmentReferenceSelect,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findAllActiveByUserId(userId: string): Promise<DepartmentReference[]> {
    try {
      return await this.prisma.department.findMany({
        where: {
          active: true,
          members: { some: { userId } },
        },
        orderBy: { name: 'asc' },
        select: departmentReferenceSelect,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findActiveDepartmentIdsByUserId(userId: string): Promise<string[]> {
    try {
      const memberships = await this.prisma.departmentMember.findMany({
        where: {
          userId,
          department: {
            active: true,
          },
        },
        select: {
          departmentId: true,
        },
      });

      return memberships.map((membership) => membership.departmentId);
    } catch (error) {
      mapPrismaError(error);
    }
  }
}

export type DepartmentReference = Prisma.DepartmentGetPayload<{
  select: typeof departmentReferenceSelect;
}>;
