import { Injectable } from '@nestjs/common';
import type { AuthenticatedRequestUser } from '../../authentication/request-user';
import { DepartmentsService } from '../../departments/departments.service';
import { PrioritiesService } from '../../priorities/priorities.service';
import type { AiToolDefinition } from '../providers/ai-provider.interface';

export const GET_TICKET_SUBMISSION_OPTIONS = 'getTicketSubmissionOptions';

export interface TicketSubmissionOptions {
  departments: Array<{ id: string; code: string; name: string }>;
  priorities: Array<{ id: string; code: string; name: string }>;
}

@Injectable()
export class ToolRegistryService {
  constructor(
    private readonly departmentsService: DepartmentsService,
    private readonly prioritiesService: PrioritiesService,
  ) {}

  definitions(): AiToolDefinition[] {
    return [
      {
        name: GET_TICKET_SUBMISSION_OPTIONS,
        description:
          'Return the active departments and priorities that this authenticated user can use to submit a ticket.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketSubmissionOptions> {
    if (name !== GET_TICKET_SUBMISSION_OPTIONS) {
      throw new Error('Unknown AI tool: ' + name);
    }
    if (Object.keys(args).length > 0) {
      throw new Error('getTicketSubmissionOptions does not accept arguments');
    }

    const [departments, priorities] = await Promise.all([
      this.departmentsService.findAll(actor, 'all'),
      this.prioritiesService.list(true),
    ]);

    return {
      departments: departments.map(({ departmentId, code, name: label }) => ({
        id: departmentId,
        code,
        name: label,
      })),
      priorities: priorities.map(({ priorityId, code, name: label }) => ({
        id: priorityId,
        code,
        name: label,
      })),
    };
  }
}
