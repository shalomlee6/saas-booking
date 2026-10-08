/**
 * Local-only migration.
 * No-show appointments with start <= customer.noShowResetAt are marked excused.
 * The customer field is then removed. Status, dates, and prices stay as stored.
 */
import 'dotenv/config';
import { validateEnv } from '../config/env';
import { connectDB } from '../config/db';
import { migrateNoShowResets } from '../services/customerNoShows';

function assertLocalMongo(uri: string): void {
  let hostname = '';
  try {
    hostname = new URL(uri).hostname.toLowerCase().replace(/^\[|\]$/g, '');
  } catch {
    hostname = '';
  }
  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') {
    throw new Error('Refusing to migrate no-show resets against a non-local MongoDB');
  }
}

async function main(): Promise<void> {
  const env = validateEnv();
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to migrate no-show resets when NODE_ENV=production');
  }
  assertLocalMongo(env.MONGO_URI);
  await connectDB(env.MONGO_URI, env.NODE_ENV);
  const result = await migrateNoShowResets();
  console.log(
    `no-show reset migration: appointmentsExcused=${result.appointmentsExcused} customersCleared=${result.customersCleared}`
  );
  process.exit(0);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'migration failed';
  console.error(message);
  process.exit(1);
});
