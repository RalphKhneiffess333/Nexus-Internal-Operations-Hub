import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { UserRole } from '@prisma/client';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import {
  ADMIN_ID,
  AGENT_ID,
  AGENT_2_ID,
  IT_AGENT_2_ID,
  EMPLOYEE_2_ID,
  EMPLOYEE_ID,
  HR_DEPARTMENT_ID,
  IT_DEPARTMENT_ID,
  ADMINISTRATION_DEPARTMENT_ID,
  resetTicketData,
  seedTestDatabase,
} from '../database/seed';
import { SubmitTicketDto } from './dto/submit-ticket.dto';
import type { UploadedFileInput } from '../files/file-validation';
import { TicketsModule } from './tickets.module';
import { TicketsService, type TicketWithPermissions } from './tickets.service';

export {
  ADMIN_ID,
  AGENT_ID,
  AGENT_2_ID,
  IT_AGENT_2_ID,
  EMPLOYEE_ID,
  EMPLOYEE_2_ID,
  HR_DEPARTMENT_ID,
  IT_DEPARTMENT_ID,
  ADMINISTRATION_DEPARTMENT_ID,
};

export async function createTicketsTestingModule(): Promise<TestingModule> {
  const moduleRef = await Test.createTestingModule({
    imports: [EventEmitterModule.forRoot(), DatabaseModule, TicketsModule],
  }).compile();

  const prisma = moduleRef.get(PrismaService);
  await prisma.$connect();
  await seedTestDatabase(prisma);
  await resetTicketData(prisma);
  return moduleRef;
}

export function submitDto(
  overrides: Partial<SubmitTicketDto> = {},
): SubmitTicketDto {
  return {
    title: 'Laptop will not start',
    description: 'The laptop stays on a black screen',
    priority: 'HIGH',
    departmentId: IT_DEPARTMENT_ID,
    ...overrides,
  };
}

export function requestUser(
  overrides: Partial<AuthenticatedRequestUser> = {},
): AuthenticatedRequestUser {
  return {
    userId: EMPLOYEE_ID,
    email: 'alex@company.com',
    fullName: 'Alex Employee',
    phoneNumber: null,
    role: UserRole.Employee,
    isActive: true,
    hasLogged: true,
    identityProviderId: 'idp-entra',
    identityProviderUserId: EMPLOYEE_ID,
    ...overrides,
  };
}

export function agentUser(userId = AGENT_ID): AuthenticatedRequestUser {
  return requestUser({
    userId,
    email: `${userId}@company.com`,
    fullName: userId,
    role: UserRole.Agent,
    identityProviderUserId: userId,
  });
}

export function adminUser(): AuthenticatedRequestUser {
  return requestUser({
    userId: ADMIN_ID,
    email: 'morgan@company.com',
    fullName: 'Morgan Admin',
    role: UserRole.Admin,
    identityProviderUserId: ADMIN_ID,
  });
}

export async function submitOpenTicket(
  service: TicketsService,
  overrides: Partial<SubmitTicketDto> = {},
  actor = requestUser(),
): Promise<TicketWithPermissions> {
  return service.submit(submitDto(overrides), actor);
}

export async function claimTicket(
  service: TicketsService,
  ticketId: string,
  actor = agentUser(),
): Promise<TicketWithPermissions> {
  return service.claim(ticketId, actor);
}

export async function closeTicket(
  service: TicketsService,
  ticketId: string,
  actor = agentUser(),
  files?: UploadedFileInput[],
): Promise<TicketWithPermissions> {
  return service.close(
    ticketId,
    {
      completionNotes: 'Replaced the power adapter',
    },
    actor,
    files,
  );
}
