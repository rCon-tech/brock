import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://brock:brock@localhost:5433/brock_test';

export default defineConfig({
  testDir: './tests/e2e',
  // One shared database and the same daily Brock per player, so keep runs simple and ordered.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Lets a machine with a pre-installed Chromium skip `playwright install`.
    launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined },
  },
  projects: [{ name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `pnpm db:migrate && pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      LAUNCH_DAY: '2026-11-01',
      // Every test starts as a brand-new visitor from the same IP.
      MAX_NEW_PLAYERS_PER_IP_HOUR: '100000',
    },
  },
});
