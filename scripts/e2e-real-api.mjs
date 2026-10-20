/**
 * `npm run e2e:real-api` — run the `real-api` Playwright project against `npm run dev:prodlike`.
 *
 * Playwright starts dev:prodlike itself (and stops it afterwards). To reuse one you already started,
 * set PLAYWRIGHT_REUSE_SERVER=1. Extra arguments go to `playwright test`.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const result = spawnSync('npx', ['playwright', 'test', '--project=real-api', ...process.argv.slice(2)], {
  cwd: path.join(root, 'apps', 'frontend-web'),
  shell: process.platform === 'win32',
  stdio: 'inherit',
  env: { ...process.env, REAL_API_E2E: 'true' },
});
process.exit(result.status ?? 1);
