import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SafeExceptionFilter } from './common/filters/safe-exception.filter';

export const API_PREFIX = 'api';

type ConfigurableApplication = INestApplication & {
  setGlobalPrefix: (prefix: string) => void;
};

/** Applies the HTTP behavior shared by production and test Nest applications. */
export function configureHttpApplication(
  app: ConfigurableApplication,
  config: ConfigService,
): void {
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({
    origin: config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new SafeExceptionFilter());
}

/**
 * Serves the compiled React application from the same origin as the API.
 * API and Socket.IO paths are excluded from the SPA fallback so unknown API
 * requests remain JSON/HTTP errors instead of receiving index.html.
 */
export function configureFrontendServing(app: INestApplication): void {
  const frontendDistPath = findFrontendDistPath();
  if (!frontendDistPath) {
    return;
  }

  const expressApp = app as NestExpressApplication;
  expressApp.useStaticAssets(frontendDistPath, { index: 'index.html' });

  const httpServer = expressApp.getHttpAdapter().getInstance();
  httpServer.use((request: any, response: any, next: () => void) => {
    const requestPath = String(request.url ?? '').split('?')[0];
    const acceptsHtml = String(request.headers?.accept ?? '').includes(
      'text/html',
    );
    const isApiRequest =
      requestPath === '/api' || requestPath.startsWith('/api/');
    const isSocketRequest =
      requestPath === '/socket.io' || requestPath.startsWith('/socket.io/');

    if (
      request.method === 'GET' &&
      acceptsHtml &&
      !isApiRequest &&
      !isSocketRequest
    ) {
      response.sendFile(resolve(frontendDistPath, 'index.html'));
      return;
    }

    next();
  });
}

function findFrontendDistPath(): string | null {
  const candidates = [
    process.env.FRONTEND_DIST_DIR,
    resolve(process.cwd(), 'frontend/nexus/dist'),
    resolve(process.cwd(), '../frontend/nexus/dist'),
    resolve(__dirname, '../../../frontend/nexus/dist'),
    resolve(__dirname, '../../../../frontend/nexus/dist'),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return (
    candidates.find((candidate) =>
      existsSync(resolve(candidate, 'index.html')),
    ) ?? null
  );
}
