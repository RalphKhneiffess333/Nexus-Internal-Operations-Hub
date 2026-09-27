import { defineConfig } from '@playwright/test';

process.env.BACKGROUND_WORKERS_ENABLED = 'false';

export default defineConfig({
  testDir: '.',
  testMatch: 'smoke/api/**/*.smoke.e2e-spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    trace: 'retain-on-failure',
  },
});
