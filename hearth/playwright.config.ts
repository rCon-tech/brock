import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const SITE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  // One shared in-memory database, and each test makes its own rooms, so keep runs ordered.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: SITE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Lets a machine with a pre-installed Chromium skip `playwright install`.
    launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined },
  },
  projects: [{ name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: SITE,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: {
      // PGlite in memory, seeded with the synthetic catalogue on first use: no services needed.
      DATABASE_URL: 'pglite://memory',
      NEXT_PUBLIC_SITE_URL: SITE,
      BETTER_AUTH_URL: SITE,
      RATE_LIMIT_MULTIPLIER: '1000',
      SOLO_AFTER_MS: '1000',
    },
  },
});
