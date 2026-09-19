import { Injectable } from '@nestjs/common';
import { Department, UserRole } from '@prisma/client';
import { ADMINISTRATION_DEPARTMENT_CODE } from './department.constants';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { DepartmentsRepository } from './repositories/departments.repository';

@Injectable()
export class DepartmentsService {
  constructor(private readonly departmentsRepository: DepartmentsRepository) {}

  findAll(actor?: AuthenticatedRequestUser): Promise<Department[]> {
    return this.departmentsRepository.findAllActive(
      !actor || actor.role === UserRole.Employee
        ? ADMINISTRATION_DEPARTMENT_CODE
        : undefined,
    );
  }

  findMine(userId: string): Promise<Department[]> {
    return this.departmentsRepository.findAllActiveByUserId(userId);
  }
}
