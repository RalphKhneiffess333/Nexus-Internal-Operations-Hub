import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? 'chrome';
const backendRoot = resolve(__dirname, '..');
const repositoryRoot = resolve(backendRoot, '..');
const frontendRoot = resolve(repositoryRoot, 'frontend', 'nexus');

export default defineConfig({
  testDir: '.',
  testMatch: 'smoke/browser/**/*.smoke.e2e-spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: browserChannel },
    },
  ],
  webServer: [
    {
      command:
        'node -r ts-node/register -r tsconfig-paths/register ./test/playwright-server.ts',
      cwd: backendRoot,
      url: 'http://localhost:3000/api/authentication/me',
      env: { BACKGROUND_WORKERS_ENABLED: 'false' },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'node ../../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173',
      cwd: frontendRoot,
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
