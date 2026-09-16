import '../setup-integration-env';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  expect,
  request as playwrightRequest,
  test as base,
} from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import type { AddressInfo } from 'net';
import type { SessionService as SessionServiceType } from '../../src/authentication/sessions/session.service';
import type { PrismaService as PrismaServiceType } from '../../src/database/prisma.service';

const { AppModule } =
  require('../../dist/src/app.module') as typeof import('../../src/app.module');
const { SESSION_COOKIE_NAME } =
  require('../../dist/src/authentication/authentication.constants') as typeof import('../../src/authentication/authentication.constants');
const { SessionService } =
  require('../../dist/src/authentication/sessions/session.service') as typeof import('../../src/authentication/sessions/session.service');
const { PrismaService } =
  require('../../dist/src/database/prisma.service') as typeof import('../../src/database/prisma.service');
const seed =
  require('../../dist/src/database/seed') as typeof import('../../src/database/seed');

export const {
  ADMIN_ID,
  AGENT_ID,
  EMPLOYEE_ID,
  EMPLOYEE_2_ID,
  resetTicketData,
  seedTestDatabase,
} = seed;

export type E2eApp = {
  app: INestApplication;
  api: APIRequestContext;
  baseURL: string;
  prisma: PrismaServiceType;
  sessionService: SessionServiceType;
};

type ApiFixture = {
  readonly app: INestApplication;
  readonly api: APIRequestContext;
  readonly baseURL: string;
  readonly prisma: PrismaServiceType;
  readonly sessionService: SessionServiceType;
  restart: () => Promise<void>;
  sessionCookie: (userId: string) => string;
};

export const test = base.extend<{ e2e: ApiFixture }>({
  e2e: async ({}, use) => {
    let current = await startE2eApp();
    await seedTestDatabase(current.prisma);
    await resetTicketData(current.prisma);

    const fixture: ApiFixture = {
      get app() {
        return current.app;
      },
      get api() {
        return current.api;
      },
      get baseURL() {
        return current.baseURL;
      },
      get prisma() {
        return current.prisma;
      },
      get sessionService() {
        return current.sessionService;
      },
      restart: async () => {
        await stopE2eApp(current);
        current = await startE2eApp();
      },
      sessionCookie: (userId: string) => sessionCookie(current, userId),
    };

    try {
      await use(fixture);
    } finally {
      await stopE2eApp(current);
    }
  },
});

export { expect };

async function startE2eApp(): Promise<E2eApp> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const prisma = app.get(PrismaService);
  const sessionService = app.get(SessionService);
  await prisma.$connect();
  await app.listen(0);

  const address = app.getHttpServer().address() as AddressInfo;
  const baseURL = `http://127.0.0.1:${address.port}`;
  const api = await playwrightRequest.newContext({ baseURL });

  return { app, api, baseURL, prisma, sessionService };
}

async function stopE2eApp(context: E2eApp | null): Promise<void> {
  if (!context) {
    return;
  }

  await context.api.dispose();
  await context.app.close();
}

function sessionCookie(context: E2eApp, userId: string): string {
  const session = context.sessionService.createSession(userId, {
    userAgent: 'playwright-api',
    ip: '127.0.0.1',
  });

  return `${SESSION_COOKIE_NAME}=${session.sessionId}`;
}
