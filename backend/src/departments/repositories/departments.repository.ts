import { Injectable } from '@nestjs/common';
import { Department } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { mapPrismaError } from '../../database/prisma-error';

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

  async findAllActive(): Promise<Department[]> {
    try {
      return await this.prisma.department.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
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
