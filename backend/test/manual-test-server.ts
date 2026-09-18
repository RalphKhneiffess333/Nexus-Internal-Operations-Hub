import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { config, parse } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { AppModule } from '../src/app.module';
import { SESSION_COOKIE_NAME } from '../src/authentication/authentication.constants';
import { SessionService } from '../src/authentication/sessions/session.service';
import { PrismaService } from '../src/database/prisma.service';
import { seedTestDatabase, TEST_USER_IDS } from '../src/database/seed';
import { ManualTestAuthController } from './manual-test-auth.controller';
import { migrateTestDatabase } from './support/migrate-test-database';

process.env.PORT = process.env.PORT ?? '3000';
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

function databaseTarget(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    const protocol =
      parsed.protocol === 'postgres:' ? 'postgresql:' : parsed.protocol;
    const port = parsed.port || (protocol === 'postgresql:' ? '5432' : '');
    const schema = parsed.searchParams.get('schema') ?? 'public';
    return [
      protocol,
      parsed.hostname.toLowerCase(),
      port,
      parsed.pathname,
      schema,
    ].join('|');
  } catch {
    return databaseUrl.trim();
  }
}

function loadTestEnvironment(): void {
  const testEnvPath = resolve(__dirname, '../.env.integration');
  if (!existsSync(testEnvPath)) {
    throw new Error(
      'Test environment is missing. Copy backend/.env.integration.example to backend/.env.integration and configure it.',
    );
  }

  config({ path: testEnvPath, override: true });
  process.env.NODE_ENV = 'test';

  const testDatabaseUrl = process.env.DATABASE_URL?.trim();
  if (!testDatabaseUrl) {
    throw new Error('DATABASE_URL is missing from backend/.env.integration');
  }

  const normalEnvPath = resolve(__dirname, '../.env');
  if (!existsSync(normalEnvPath)) {
    migrateTestDatabase();
    return;
  }

  const normalDatabaseUrl = parse(readFileSync(normalEnvPath, 'utf8'))[
    'DATABASE_URL'
  ]?.trim();
  if (
    normalDatabaseUrl &&
    databaseTarget(normalDatabaseUrl) === databaseTarget(testDatabaseUrl)
  ) {
    throw new Error(
      'Test mode refused to start because backend/.env.integration points to the normal application database.',
    );
  }

  migrateTestDatabase();
}

loadTestEnvironment();

async function printTestSessions(
  prisma: PrismaService,
  sessionService: SessionService,
): Promise<void> {
  const users = await prisma.user.findMany({
    where: { userId: { in: [...TEST_USER_IDS] } },
  });
  const usersById = new Map(users.map((user) => [user.userId, user]));

  console.log('\nNexus test mode is ready.');
  console.log(
    'Use any of these Cookie header values for direct API testing:\n',
  );

  for (const userId of TEST_USER_IDS) {
    const user = usersById.get(userId);
    if (!user) {
      continue;
    }

    const session = sessionService.createSession(user.userId, {
      userAgent: 'nexus-test-mode',
      ip: '127.0.0.1',
    });
    console.log(`${user.fullName} (${user.role})`);
    console.log(`Cookie: ${SESSION_COOKIE_NAME}=${session.sessionId}\n`);
  }

  console.log(`Frontend: ${process.env.FRONTEND_URL}`);
  console.log(`Backend:  http://localhost:${process.env.PORT}\n`);
}

async function bootstrap(): Promise<void> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [ManualTestAuthController],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const prisma = app.get(PrismaService);
  const sessionService = app.get(SessionService);
  ManualTestAuthController.prisma = prisma;
  ManualTestAuthController.sessionService = sessionService;

  await prisma.$connect();
  await seedTestDatabase(prisma);
  await app.listen(Number(process.env.PORT));
  await printTestSessions(prisma, sessionService);

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

void bootstrap();
