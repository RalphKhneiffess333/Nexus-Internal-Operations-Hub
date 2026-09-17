import { execFileSync } from 'child_process';
import { resolve } from 'path';

const backendRoot = resolve(__dirname, '../..');
const prismaCli = resolve(backendRoot, 'node_modules/prisma/build/index.js');

let migrated = false;

export function migrateTestDatabase(): void {
  if (migrated) {
    return;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Load backend/.env.integration before migrating the test database.',
    );
  }

  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: backendRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });

  migrated = true;
}
