import { existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { migrateTestDatabase } from './support/migrate-test-database';

const envPath = resolve(__dirname, '../.env.integration');

if (!existsSync(envPath)) {
  throw new Error(
    'Integration test environment is missing. Copy backend/.env.integration.example to backend/.env.integration and fill in the database connection.',
  );
}

config({ path: envPath, override: true });
process.env.NODE_ENV = 'test';
migrateTestDatabase();
