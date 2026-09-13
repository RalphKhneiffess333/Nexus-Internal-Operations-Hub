import { Injectable } from '@nestjs/common';
import { Department } from '@prisma/client';
import { DepartmentsRepository } from './repositories/departments.repository';

@Injectable()
export class DepartmentsService {
  constructor(private readonly departmentsRepository: DepartmentsRepository) {}

  findAll(): Promise<Department[]> {
    return this.departmentsRepository.findAllActive();
  }
}
