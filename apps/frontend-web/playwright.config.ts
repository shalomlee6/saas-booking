import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against the Angular app with `configuration=mock` so no API is required.
 * For live API tests, start the stack yourself, set `CI=1` and `reuseExistingServer`,
 * and point `baseURL` at your dev server.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    /** Port 4201 avoids clashing with a developer `ng serve` on 4200. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4201',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npx ng serve --configuration=mock --host 127.0.0.1 --port 4201',
        url: 'http://127.0.0.1:4201',
        reuseExistingServer: !!process.env.PLAYWRIGHT_REUSE_SERVER,
        timeout: 180_000,
      },
});
