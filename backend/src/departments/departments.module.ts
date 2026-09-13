import { Module } from '@nestjs/common';
import { DepartmentsController } from './departments.controller';
import { DepartmentsRepository } from './repositories/departments.repository';
import { DepartmentsService } from './departments.service';

@Module({
  controllers: [DepartmentsController],
  providers: [DepartmentsService, DepartmentsRepository],
  exports: [DepartmentsRepository],
})
export class DepartmentsModule {}
