import type { TestType } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import '../setup-integration-env';
import {
  AGENT_ID,
  EMPLOYEE_ID,
  IT_DEPARTMENT_ID,
  resetTicketData,
  seedTestDatabase,
} from '../../src/database/seed';

export { AGENT_ID, EMPLOYEE_ID, IT_DEPARTMENT_ID };

export const prisma = new PrismaClient();

export function installSeededDatabaseHooks<TestArgs extends {}, WorkerArgs extends {}>(
  test: TestType<TestArgs, WorkerArgs>,
): void {
  test.beforeAll(async () => {
    await prisma.$connect();
  });

  test.beforeEach(async () => {
    await seedTestDatabase(prisma);
    await resetTicketData(prisma);
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });
}
