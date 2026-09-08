import { Module } from '@nestjs/common';
import { DepartmentsRepository } from './repositories/departments.repository';

@Module({
  providers: [DepartmentsRepository],
  exports: [DepartmentsRepository],
})
export class DepartmentsModule {}
