import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import {
  HR_DEPARTMENT_ID,
  IT_DEPARTMENT_ID,
  seedDatabase,
} from '../database/seed';
import { DepartmentsModule } from './departments.module';
import { DepartmentsService } from './departments.service';

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule, DepartmentsModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
    await seedDatabase(prisma);
    await prisma.department.updateMany({ data: { active: true } });
    service = moduleRef.get(DepartmentsService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('lists active departments from the database', async () => {
    const departments = await service.findAll();

    expect(departments.map((department) => department.departmentId).sort()).toEqual(
      [HR_DEPARTMENT_ID, IT_DEPARTMENT_ID].sort(),
    );
    expect(departments.every((department) => department.active)).toBe(true);
    expect(departments.map((department) => department.name).sort()).toEqual([
      'Human Resources',
      'Information Technology',
    ]);
  });

  it('omits inactive departments', async () => {
    await prisma.department.update({
      where: { departmentId: HR_DEPARTMENT_ID },
      data: { active: false },
    });

    try {
      const departments = await service.findAll();
      expect(departments.map((department) => department.departmentId)).toEqual([
        IT_DEPARTMENT_ID,
      ]);
    } finally {
      await prisma.department.update({
        where: { departmentId: HR_DEPARTMENT_ID },
        data: { active: true },
      });
    }
  });
});
