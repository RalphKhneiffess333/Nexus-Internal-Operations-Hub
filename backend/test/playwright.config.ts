import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? 'chrome';
const backendRoot = resolve(__dirname, '..');
const repositoryRoot = resolve(backendRoot, '..');

export default defineConfig({
  testDir: '.',
  testMatch: 'browser/**/*.browser.e2e-spec.ts',
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
      command: 'npx ts-node ./test/playwright-server.ts',
      cwd: backendRoot,
      url: 'http://localhost:3000/authentication/me',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command:
        'npm run dev --workspace=@nexus/frontend -- --host 127.0.0.1 --port 5173',
      cwd: repositoryRoot,
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
