/**
 * `npm run dev:prodlike` — run the real API and the production web build locally, wired together,
 * with production configuration. Nothing here uses the mock API interceptor.
 *
 *   API      node apps/api/dist/index.js   (built first)      http://localhost:3100
 *   Web      ng serve --configuration=production              http://localhost:4300  (proxies /api and /uploads)
 *   Database a dedicated local database, never your development one
 *
 * Production values are used for everything EXCEPT two things that cannot work on plain http://localhost:
 *   - Secure cookies
 *   - the SMS provider (a log provider instead of the real gateway)
 * Both are switched by PRODLIKE_LOCAL=true, which the API only honors when NODE_ENV=production AND
 * MONGO_URI, BASE_URL and CLIENT_ORIGIN are all local. See README.md.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { API_PORT, MONGO_URI, PRODLIKE_API_ENV, WEB_PORT } from './prodlike-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const isWindows = process.platform === 'win32';
const children = [];
let stopping = false;

function log(message) {
  console.log(`[prodlike] ${message}`);
}

function prefixed(name, stream) {
  let pending = '';
  stream.on('data', (chunk) => {
    pending += chunk.toString();
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? '';
    for (const line of lines) if (line.trim()) console.log(`[${name}] ${line}`);
  });
}

function run(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...options.env },
    shell: isWindows,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  prefixed(name, child.stdout);
  prefixed(name, child.stderr);
  child.on('exit', (code) => {
    if (!stopping) {
      log(`${name} exited with code ${code}; stopping the rest.`);
      stop(code ?? 1);
    }
  });
  children.push(child);
  return child;
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.pid === undefined) continue;
    if (isWindows) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 300).unref();
}

/** Production refuses to book without MongoDB transactions, so a standalone mongod is a hard stop. */
async function assertReplicaSet() {
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const hello = await client.db('admin').command({ hello: 1 });
    if (!hello.setName) {
      throw new Error(
        'MongoDB is running without a replica set. Production needs transactions to create appointments.\n' +
          '  Start mongod with --replSet rs0 and run rs.initiate() once (see README).'
      );
    }
  } finally {
    await client.close().catch(() => undefined);
  }
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

try {
  log(`MongoDB: ${MONGO_URI}`);
  await assertReplicaSet();
} catch (error) {
  console.error(`[prodlike] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

log('Building the API (tsc)...');
const build = spawnSync('npm', ['run', 'build', '-w', '@saas-booking/api'], {
  cwd: root,
  shell: isWindows,
  stdio: 'inherit',
});
if (build.status !== 0) process.exit(build.status ?? 1);

log(`API  → http://localhost:${API_PORT}   (NODE_ENV=production, IDENTITY_MODE=phone)`);
run('api', 'node', ['dist/index.js'], { cwd: path.join(root, 'apps', 'api'), env: PRODLIKE_API_ENV });

log(`Web  → http://localhost:${WEB_PORT}   (production build, /api proxied to the real API)`);
run('web', 'npm', ['run', 'start:prodlike', '-w', 'frontend-web']);
