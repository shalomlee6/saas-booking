/**
 * `npm run seed:prodlike` — reset the dedicated prod-like database to known fixtures.
 * Runs the API's seed script with a development environment (the script refuses NODE_ENV=production)
 * against the same database `npm run dev:prodlike` uses. Your development database is never touched.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MONGO_URI } from './prodlike-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const result = spawnSync('npm', ['run', 'seed:prodlike', '-w', '@saas-booking/api'], {
  cwd: root,
  shell: process.platform === 'win32',
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development', MONGO_URI },
});
process.exit(result.status ?? 1);
