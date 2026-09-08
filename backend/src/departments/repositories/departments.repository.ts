import { Injectable } from '@nestjs/common';
import { InMemoryDatabase } from '../../database/in-memory-database';
import { Department } from '../entities/department.entity';

@Injectable()
export class DepartmentsRepository {
  constructor(private readonly database: InMemoryDatabase) {}

  findById(departmentId: string): Department | undefined {
    return this.database.departments.find(
      (department) => department.departmentId === departmentId,
    );
  }
}
