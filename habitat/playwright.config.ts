import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const PORT = 3100;
const DB =
  process.env.E2E_DATABASE_URL ??
  process.env.TEST_DATABASE_URL ??
  'postgres://habitat:habitat@localhost:5433/habitat_test';
// The sandbox ships its own Chromium; fall back to Playwright's when it isn't there.
const sandboxChromium = '/opt/pw-browsers/chromium';

export const e2eEnv = {
  DATABASE_URL: DB,
  NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
  BETTER_AUTH_URL: `http://localhost:${PORT}`,
  BETTER_AUTH_SECRET: 'e2e-secret-e2e-secret-e2e-secret-1234',
  EMAIL_TRANSPORT: 'outbox',
  CRON_SECRET: 'e2e-cron-secret',
};

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: existsSync(sandboxChromium) ? { executablePath: sandboxChromium } : undefined,
  },
  projects: [
    {
      name: 'phone',
      use: {
        ...devices['Pixel 7'],
        launchOptions: existsSync(sandboxChromium)
          ? { executablePath: sandboxChromium }
          : undefined,
      },
    },
  ],
  webServer: {
    // Dev mode on purpose: a production server refuses EMAIL_TRANSPORT=outbox, which the tests need.
    command: `pnpm exec next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: e2eEnv,
  },
});
