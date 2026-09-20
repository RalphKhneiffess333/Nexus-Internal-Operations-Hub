import { Injectable } from '@nestjs/common';
import { PrioritiesRepository, PriorityRecord } from './priorities.repository';

@Injectable()
export class PrioritiesService {
  constructor(private readonly repository: PrioritiesRepository) {}

  list(activeOnly = false): Promise<PriorityRecord[]> {
    return this.repository.list(activeOnly);
  }

  findByCode(code: string): Promise<PriorityRecord | null> {
    return this.repository.findByCode(code);
  }
}
