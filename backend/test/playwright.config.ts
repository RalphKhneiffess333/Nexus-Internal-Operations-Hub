import { defineConfig, devices } from '@playwright/test';

const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? 'chrome';

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
      command: 'npx ts-node ./playwright-server.ts',
      url: 'http://localhost:3000/authentication/me',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command:
        'npm --prefix ../../frontend/nexus run dev -- --host 127.0.0.1 --port 5173',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
