import { Module } from '@nestjs/common';
import { PrioritiesController } from './priorities.controller';
import { PrioritiesRepository } from './priorities.repository';
import { PrioritiesService } from './priorities.service';

@Module({
  controllers: [PrioritiesController],
  providers: [PrioritiesRepository, PrioritiesService],
  exports: [PrioritiesRepository, PrioritiesService],
})
export class PrioritiesModule {}
