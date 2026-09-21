import { Module } from '@nestjs/common';
import { DepartmentsModule } from '../departments/departments.module';
import { PrioritiesModule } from '../priorities/priorities.module';
import { TicketsModule } from '../tickets/tickets.module';
import { FilterOptionsService } from './filter-options.service';
import { FiltersController } from './filters.controller';

@Module({
  imports: [DepartmentsModule, PrioritiesModule, TicketsModule],
  controllers: [FiltersController],
  providers: [FilterOptionsService],
  exports: [FilterOptionsService],
})
export class FiltersModule {}
