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
}
