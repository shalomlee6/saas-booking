/**
 * Migration: removes the unused `theme.colors.accent` and `theme.colors.text` from every business's settings.
 * Safe to re-run (it only touches documents that still have them). Run with `npm run migrate:theme-colors`.
 *
 * Like the other data scripts it refuses a non-local MongoDB and NODE_ENV=production by default.
 * To run it against a real deployment, pass `--allow-remote` and point MONGO_URI at that database on purpose.
 */
import 'dotenv/config';
import { validateEnv } from '../config/env';
import { connectDB } from '../config/db';
import { removeThemeAccentAndText } from '../services/settingsMigrations';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

function isLocal(uri: string): boolean {
  try {
    return LOCAL_HOSTNAMES.has(new URL(uri).hostname.toLowerCase().replace(/^\[|\]$/g, ''));
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const allowRemote = process.argv.includes('--allow-remote');
  const env = validateEnv();
  if (!allowRemote && env.NODE_ENV === 'production') {
    throw new Error('Refusing to run with NODE_ENV=production without --allow-remote');
  }
  if (!allowRemote && !isLocal(env.MONGO_URI)) {
    throw new Error('Refusing to run against a non-local MongoDB without --allow-remote');
  }
  await connectDB(env.MONGO_URI, env.NODE_ENV);
  const result = await removeThemeAccentAndText();
  console.log(`theme colors migration: matched=${result.matched} modified=${result.modified}`);
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'migration failed');
  process.exit(1);
});
