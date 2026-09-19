import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ADMINISTRATION_DEPARTMENT_CODE } from './department.constants';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { DepartmentsRepository } from './repositories/departments.repository';

export interface DepartmentResponse {
  departmentId: string;
  code: string;
  name: string;
  desc: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DepartmentsService {
  constructor(private readonly departmentsRepository: DepartmentsRepository) {}

  async findAll(actor?: AuthenticatedRequestUser): Promise<DepartmentResponse[]> {
    const departments = await this.departmentsRepository.findAllActive(
      !actor || actor.role === UserRole.Employee
        ? ADMINISTRATION_DEPARTMENT_CODE
        : undefined,
    );
    return departments.map((department) => this.toResponse(department));
  }

  async findMine(userId: string): Promise<DepartmentResponse[]> {
    const departments =
      await this.departmentsRepository.findAllActiveByUserId(userId);
    return departments.map((department) => this.toResponse(department));
  }

  private toResponse(department: {
    departmentId: string;
    code: string;
    name: string;
    desc: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): DepartmentResponse {
    return {
      departmentId: department.departmentId,
      code: department.code,
      name: department.name,
      desc: department.desc,
      active: department.active,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    };
  }
}
