import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { logSystemError } from './common/logging/system-error.logger';
import {
  configureFrontendServing,
  configureHttpApplication,
} from './app-configuration';

const bootstrapLogger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  configureHttpApplication(app, config);
  configureFrontendServing(app);
  await app.listen(config.get<string>('PORT') ?? 3000);
}
process.on('uncaughtExceptionMonitor', (error) => {
  logSystemError(bootstrapLogger, error, {
    operation: 'process.uncaught-exception',
    object: { type: 'application', id: 'backend' },
  });
});

process.on('unhandledRejection', (reason) => {
  logSystemError(bootstrapLogger, reason, {
    operation: 'process.unhandled-rejection',
    object: { type: 'application', id: 'backend' },
  });
});

void bootstrap().catch((error: unknown) => {
  logSystemError(bootstrapLogger, error, {
    operation: 'application.bootstrap',
    object: { type: 'application', id: 'backend' },
  });
  process.exitCode = 1;
});
