/**
 * Runs once before the `real-api` project: waits for `npm run dev:prodlike`, resets the dedicated
 * prod-like database to its fixtures, and proves the API really is in production-like phone mode.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '@playwright/test';

export const API = 'http://localhost:3100';
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

test('seed the prod-like database and check the API configuration', async ({ request }) => {
  test.setTimeout(240_000);

  await expect
    .poll(async () => (await request.get(`${API}/api/ready`).catch(() => null))?.status(), {
      timeout: 120_000,
      intervals: [1_000],
    })
    .toBe(200);

  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'seed-prodlike.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  const config = await request.get(`${API}/api/public/businesses/prodlike-salon/config`);
  expect(config.status()).toBe(200);
  expect((await config.json()).identityMode).toBe('phone');
});
