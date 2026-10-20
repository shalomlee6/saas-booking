import { defineConfig, devices } from '@playwright/test';

/**
 * Default: `configuration=mock` — no API or Mongo required.
 *
 * Real API: set `USE_REAL_API=true`, `E2E_TEST_SEED_SECRET` (must match the API), and ensure the API has
 * `SUPER_ADMIN_EMAILS` including `superadmin@example.com` (or `E2E_SEED_SUPER_ADMIN_EMAIL`).
 * Optionally set `CLIENT_ORIGIN=http://127.0.0.1:4201` on the API for CORS.
 *
 * Project `real-api`: the public booking flows against `npm run dev:prodlike` (real API, production
 * build, phone identity mode, dedicated local MongoDB). Run it with `npm run e2e:real-api`, which sets
 * REAL_API_E2E=true; that is the only way the project (and its web server) exists, so the mock suites
 * never need a database.
 */
const realApiRun = process.env.REAL_API_E2E === 'true';
const PRODLIKE_WEB_URL = 'http://localhost:4300';

const mockWebServer = {
  command: 'npx ng serve --configuration=mock --host 127.0.0.1 --port 4201',
  url: 'http://127.0.0.1:4201',
  reuseExistingServer: !!process.env.PLAYWRIGHT_REUSE_SERVER,
  timeout: 180_000,
};

const prodlikeWebServer = {
  command: 'npm run dev:prodlike',
  cwd: '../..',
  url: PRODLIKE_WEB_URL,
  reuseExistingServer: !!process.env.PLAYWRIGHT_REUSE_SERVER,
  // Builds the API, then the production web bundle.
  timeout: 300_000,
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
  projects: realApiRun
    ? [
        // Seeds the dedicated database and checks the API is production-like before anything runs.
        { name: 'real-api-setup', testMatch: /real-api\/setup\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
        {
          name: 'real-api',
          testMatch: /real-api\/.*\.spec\.ts/,
          testIgnore: /real-api\/setup\.spec\.ts/,
          dependencies: ['real-api-setup'],
          use: { ...devices['Desktop Chrome'], baseURL: PRODLIKE_WEB_URL },
        },
      ]
    : [{ name: 'chromium', testIgnore: /real-api\//, use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : realApiRun
      ? prodlikeWebServer
      : process.env.USE_REAL_API === 'true'
      ? realApiWebServers
      : mockWebServer,
});
