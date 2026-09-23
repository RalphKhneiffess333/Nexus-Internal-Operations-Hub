import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedRequestUser } from '../../authentication/request-user';
import { sanitizePlainText } from '../../common/sanitization/content-sanitizer';
import { DepartmentsService } from '../../departments/departments.service';
import { PrioritiesService } from '../../priorities/priorities.service';
import type { TicketEventRecord } from '../../tickets/events/ticket-event.types';
import { TicketsService } from '../../tickets/tickets.service';
import type { AiToolDefinition } from '../providers/ai-provider.interface';

export const GET_TICKET_SUBMISSION_OPTIONS = 'getTicketSubmissionOptions';
export const GET_TICKET_BY_NUMBER = 'getTicketByNumber';

export interface TicketSubmissionOptions {
  departments: Array<{ id: string; code: string; name: string }>;
  priorities: Array<{ id: string; code: string; name: string }>;
}

export interface TicketInformationResult {
  accessible: boolean;
  message?: string;
  ticket?: {
    ticketNumber: string;
    title: string;
    description: string;
    status: string;
    active: boolean;
    priority: { code: string; name?: string };
    department: { code: string; name: string };
    submitter: { fullName: string };
    assignedAgent: { fullName: string } | null;
    submittedAt: string;
    lastUpdatedAt: string;
    closedAt: string | null;
    completionNotes: string | null;
    events: Array<{
      action: string;
      occurredAt: string;
      actor: string;
      details: Record<string, unknown>;
    }>;
  };
}

export interface ToolDefinitionOptions {
  includeSubmissionOptions?: boolean;
  includeTicketByNumber?: boolean;
}

const TICKET_NUMBER_PATTERN = /^TKT-\d{4,}$/i;
const MAX_TICKET_TEXT_LENGTH = 10000;

function safeText(value: string | null | undefined): string {
  return sanitizePlainText(value ?? '').slice(0, MAX_TICKET_TEXT_LENGTH);
}

function safeEventDetails(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const details: Record<string, unknown> = {};
  for (const [key, detail] of Object.entries(value)) {
    if (key === 'email' || key === 'userId' || key === 'role') continue;
    if (typeof detail === 'string') {
      details[key] = safeText(detail);
      continue;
    }
    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
      const reference = detail as Record<string, unknown>;
      if (typeof reference.fullName === 'string') {
        details[key] = { fullName: safeText(reference.fullName) };
        continue;
      }
    }
    details[key] = detail;
  }
  return details;
}

function mapEvent(event: TicketEventRecord) {
  return {
    action: event.action,
    occurredAt: event.createdAt.toISOString(),
    actor: safeText(event.user.fullName),
    details: safeEventDetails(event.details),
  };
}

@Injectable()
export class ToolRegistryService {
  constructor(
    private readonly departmentsService: DepartmentsService,
    private readonly prioritiesService: PrioritiesService,
    private readonly ticketsService: TicketsService,
  ) {}

  definitions(options: ToolDefinitionOptions = {}): AiToolDefinition[] {
    const definitions: AiToolDefinition[] = [];

    if (options.includeSubmissionOptions) {
      definitions.push({
        name: GET_TICKET_SUBMISSION_OPTIONS,
        description:
          'Return the active departments and priorities that this authenticated user can use to submit a ticket.',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      });
    }

    if (options.includeTicketByNumber) {
      definitions.push({
        name: GET_TICKET_BY_NUMBER,
        description:
          'Retrieve one specific ticket by its exact ticket number, including its authorized details and chronological lifecycle events. Use only when the user provided or clearly referenced one ticket number.',
        parameters: {
          type: 'object',
          properties: {
            ticketNumber: {
              type: 'string',
              description: 'The exact ticket number, for example TKT-0042.',
            },
          },
          required: ['ticketNumber'],
          additionalProperties: false,
        },
      });
    }

    return definitions;
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketSubmissionOptions | TicketInformationResult> {
    if (name === GET_TICKET_SUBMISSION_OPTIONS) {
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

    if (name === GET_TICKET_BY_NUMBER) {
      return this.getTicketByNumber(args, actor);
    }

    throw new Error('Unknown AI tool: ' + name);
  }

  private async getTicketByNumber(
    args: Record<string, unknown>,
    actor: AuthenticatedRequestUser,
  ): Promise<TicketInformationResult> {
    if (
      Object.keys(args).length !== 1 ||
      typeof args.ticketNumber !== 'string'
    ) {
      return {
        accessible: false,
        message:
          'I could not process that ticket number. Please provide one ticket number such as TKT-0042.',
      };
    }

    const ticketNumber = args.ticketNumber.trim().toUpperCase();
    if (!TICKET_NUMBER_PATTERN.test(ticketNumber)) {
      return {
        accessible: false,
        message:
          'I could not process that ticket number. Please provide one ticket number such as TKT-0042.',
      };
    }

    try {
      const ticket = await this.ticketsService.findOneByCode(
        ticketNumber,
        actor,
      );
      const events = await this.ticketsService.findEvents(
        ticket.ticketId,
        actor,
      );
      const priority = await this.prioritiesService.findByCode(ticket.priority);

      return {
        accessible: true,
        ticket: {
          ticketNumber: ticket.ticketCode,
          title: safeText(ticket.title),
          description: safeText(ticket.description),
          status: ticket.status,
          active: ticket.active,
          priority: {
            code: ticket.priority,
            ...(priority ? { name: safeText(priority.name) } : {}),
          },
          department: {
            code: safeText(ticket.department.code),
            name: safeText(ticket.department.name),
          },
          submitter: { fullName: safeText(ticket.submittedBy.fullName) },
          assignedAgent: ticket.agent
            ? { fullName: safeText(ticket.agent.fullName) }
            : null,
          submittedAt: ticket.createdAt.toISOString(),
          lastUpdatedAt: ticket.updatedAt.toISOString(),
          closedAt: ticket.closedAt?.toISOString() ?? null,
          completionNotes: ticket.completionNotes
            ? safeText(ticket.completionNotes)
            : null,
          events: events.map(mapEvent),
        },
      };
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        return {
          accessible: false,
          message:
            "I couldn't access that ticket. Check the ticket number or your permissions.",
        };
      }
      throw error;
    }
  }
}
