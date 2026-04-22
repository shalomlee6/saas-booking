import { defineConfig, devices } from '@playwright/test';

/**
 * Default: `configuration=mock` — no API or Mongo required.
 *
 * Real API: set `USE_REAL_API=true`, `E2E_TEST_SEED_SECRET` (must match the API), and ensure the API has
 * `SUPER_ADMIN_EMAILS` including `superadmin@example.com` (or `E2E_SEED_SUPER_ADMIN_EMAIL`).
 * Optionally set `CLIENT_ORIGIN=http://127.0.0.1:4201` on the API for CORS.
 */
const mockWebServer = {
  command: 'npx ng serve --configuration=mock --host 127.0.0.1 --port 4201',
  url: 'http://127.0.0.1:4201',
  reuseExistingServer: !!process.env.PLAYWRIGHT_REUSE_SERVER,
  timeout: 180_000,
};

const realApiWebServers = [
  {
    command: 'npm run dev',
    cwd: '../api',
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: !!process.env.PLAYWRIGHT_REUSE_SERVER,
    timeout: 120_000,
  },
  {
    command: 'npx ng serve --configuration=e2e --host 127.0.0.1 --port 4201',
    url: 'http://127.0.0.1:4201',
    reuseExistingServer: !!process.env.PLAYWRIGHT_REUSE_SERVER,
    timeout: 180_000,
  },
];

export default defineConfig({
  testDir: './e2e',
  globalSetup: process.env.USE_REAL_API === 'true' ? './e2e/global-setup.ts' : undefined,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4201',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : process.env.USE_REAL_API === 'true'
      ? realApiWebServers
      : mockWebServer,
});
