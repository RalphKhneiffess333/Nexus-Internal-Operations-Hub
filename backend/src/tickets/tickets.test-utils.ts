import { Test, TestingModule } from '@nestjs/testing';
import { Ticket, TicketPriority } from '@prisma/client';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import {
  AGENT_ID,
  EMPLOYEE_ID,
  HR_DEPARTMENT_ID,
  IT_DEPARTMENT_ID,
  resetTicketData,
  seedDatabase,
} from '../database/seed';
import { SubmitTicketDto } from './dto/submit-ticket.dto';
import { TicketsModule } from './tickets.module';
import { TicketsService } from './tickets.service';

export { AGENT_ID, EMPLOYEE_ID, HR_DEPARTMENT_ID, IT_DEPARTMENT_ID };

export async function createTicketsTestingModule(): Promise<TestingModule> {
  const moduleRef = await Test.createTestingModule({
    imports: [DatabaseModule, TicketsModule],
  }).compile();

  const prisma = moduleRef.get(PrismaService);
  await prisma.$connect();
  await seedDatabase(prisma);
  await resetTicketData(prisma);
  return moduleRef;
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
