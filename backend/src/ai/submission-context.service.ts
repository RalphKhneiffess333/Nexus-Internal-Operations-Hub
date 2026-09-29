import { Injectable } from '@nestjs/common';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { DepartmentsService } from '../departments/departments.service';
import { PrioritiesService } from '../priorities/priorities.service';

export interface TicketSubmissionOptions {
  departments: Array<{ id: string; code: string; name: string }>;
  priorities: Array<{ id: string; code: string; name: string }>;
}

@Injectable()
export class SubmissionContextService {
  constructor(
    private readonly departmentsService: DepartmentsService,
    private readonly prioritiesService: PrioritiesService,
  ) {}

  async load(
    actor: AuthenticatedRequestUser,
  ): Promise<TicketSubmissionOptions> {
    const [departments, priorities] = await Promise.all([
      this.departmentsService.findAll(actor, 'all'),
      this.prioritiesService.list(true),
    ]);

    return {
      departments: departments.map(({ departmentId, code, name }) => ({
        id: departmentId,
        code,
        name,
      })),
      priorities: priorities.map(({ priorityId, code, name }) => ({
        id: priorityId,
        code,
        name,
      })),
    };
  }
}
