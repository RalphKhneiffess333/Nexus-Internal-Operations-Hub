import './setup-integration-env';

import { Body, Controller, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { Public } from '../src/authorization/decorators/public.decorator';
import { SESSION_COOKIE_NAME } from '../src/authentication/authentication.constants';
import { SessionService } from '../src/authentication/sessions/session.service';
import { PrismaService } from '../src/database/prisma.service';
import { resetTicketData, seedTestDatabase } from '../src/database/seed';
import { configureHttpApplication } from '../src/app-configuration';

process.env.PORT = process.env.PORT ?? '3000';
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

@Controller('__e2e')
class E2eController {
  static sessionService: SessionService;

  @Public()
  @Post('sessions')
  createSession(@Body('userId') userId: string) {
    const session = E2eController.sessionService.createSession(userId, {
      userAgent: 'playwright',
      ip: '127.0.0.1',
    });

    return {
      cookieName: SESSION_COOKIE_NAME,
      sessionId: session.sessionId,
    };
  }
}

async function bootstrap() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [E2eController],
  }).compile();

  const app = moduleRef.createNestApplication();
  E2eController.sessionService = app.get(SessionService);
  configureHttpApplication(app, app.get(ConfigService));

  const prisma = app.get(PrismaService);
  await prisma.$connect();
  await seedTestDatabase(prisma);
  await resetTicketData(prisma);

  await app.listen(Number(process.env.PORT));

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

void bootstrap();
