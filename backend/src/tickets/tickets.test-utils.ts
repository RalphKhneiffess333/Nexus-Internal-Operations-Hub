import { Test, TestingModule } from '@nestjs/testing';
import { TicketPriority } from '../common/enums/ticket-priority.enum';
import { TicketStatus } from '../common/enums/ticket-status.enum';
import { DatabaseModule } from '../database/database.module';
import { SubmitTicketDto } from './dto/submit-ticket.dto';
import { Ticket } from './entities/ticket.entity';
import { TicketsModule } from './tickets.module';
import { TicketsService } from './tickets.service';

export const EMPLOYEE_ID = 'user-employee-1';
export const AGENT_ID = 'user-agent-1';
export const IT_DEPARTMENT_ID = 'dept-it';
export const HR_DEPARTMENT_ID = 'dept-hr';

export async function createTicketsTestingModule(): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [DatabaseModule, TicketsModule],
  }).compile();
}

export function submitDto(
  overrides: Partial<SubmitTicketDto> = {},
): SubmitTicketDto {
  return {
    title: 'Laptop will not start',
    description: 'The laptop stays on a black screen',
    priority: TicketPriority.HIGH,
    departmentId: IT_DEPARTMENT_ID,
    submittedBy: EMPLOYEE_ID,
    ...overrides,
  };
}

export async function submitOpenTicket(
  service: TicketsService,
  overrides: Partial<SubmitTicketDto> = {},
): Promise<Ticket> {
  return service.submit(submitDto(overrides));
}

export async function claimTicket(
  service: TicketsService,
  ticketId: string,
  agentId = AGENT_ID,
): Promise<Ticket> {
  return service.claim(ticketId, { agentId });
}

export async function closeTicket(
  service: TicketsService,
  ticketId: string,
): Promise<Ticket> {
  return service.close(ticketId, {
    completionNotes: 'Replaced the power adapter',
  });
}
