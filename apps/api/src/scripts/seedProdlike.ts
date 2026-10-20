/**
 * Fixture data for the `real-api` Playwright project — run with `npm run seed:prodlike`.
 *
 * Wipes and re-creates ONE dedicated local database (`saas-booking-prodlike`) so every run starts
 * from the same state. It never touches your development database. It refuses to run when:
 *   - NODE_ENV=production (run it with the normal development env; the prod-like API reads the result),
 *   - MONGO_URI is not local, or
 *   - the database name is not the dedicated prod-like one.
 * Collections are emptied (not dropped) so the unique indexes the running API created stay in place.
 */
import mongoose from 'mongoose';
import { validateEnv } from '../config/env';
import { connectDB } from '../config/db';
import { Customer } from '../models/Customer';
import { Service } from '../models/Service';
import { BusinessSettings } from '../models/BusinessSettings';
import { provisionTenant } from '../utils/provisionTenant';

export const PRODLIKE_DB_NAME = 'saas-booking-prodlike';
export const PRODLIKE_SLUG = 'prodlike-salon';
export const PRODLIKE_KNOWN_PHONE = '0501111111';
export const PRODLIKE_OWNER_EMAIL = 'prodlike-owner@example.test';
export const PRODLIKE_OWNER_PASSWORD = 'ProdlikeOwner123!';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

function assertDedicatedLocalDatabase(uri: string): void {
  let hostname = '';
  let dbName = '';
  try {
    const parsed = new URL(uri);
    hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    dbName = parsed.pathname.replace(/^\//, '');
  } catch {
    // Unparseable URIs fail closed below.
  }
  if (!LOCAL_HOSTNAMES.has(hostname) || dbName !== PRODLIKE_DB_NAME) {
    console.error(
      `Refusing to run seed:prodlike — MONGO_URI must be a local MongoDB database named "${PRODLIKE_DB_NAME}".\n  Got: ${uri}`
    );
    process.exit(1);
  }
}

async function emptyEveryCollection(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('database handle missing');
  for (const { name } of await db.listCollections().toArray()) {
    if (name.startsWith('system.')) continue;
    await db.collection(name).deleteMany({});
  }
}

async function main(): Promise<void> {
  const env = validateEnv();
  if (env.NODE_ENV === 'production') {
    console.error('Refusing to run seed:prodlike with NODE_ENV=production.');
    process.exit(1);
  }
  assertDedicatedLocalDatabase(env.MONGO_URI);
  await connectDB(env.MONGO_URI, env.NODE_ENV);
  await emptyEveryCollection();

  const tenant = await provisionTenant({
    businessName: 'Prodlike Salon',
    ownerFullName: 'Prodlike Owner',
    ownerEmail: PRODLIKE_OWNER_EMAIL,
    plan: 'pro',
    timezone: 'Asia/Jerusalem',
    businessSlug: PRODLIKE_SLUG,
    ownerPassword: PRODLIKE_OWNER_PASSWORD,
  });

  await Service.updateOne(
    { _id: tenant.serviceId },
    { $set: { name: 'מניקור', durationMinutes: 45, price: 120, isActive: true } }
  );
  await BusinessSettings.updateOne(
    { businessId: tenant.businessId },
    { $set: { 'features.bookingEnabled': true } }
  );
  await Customer.create({
    businessId: tenant.businessId,
    name: 'נועה לוי',
    firstName: 'נועה',
    lastName: 'לוי',
    phone: PRODLIKE_KNOWN_PHONE,
    birthday: { day: 2, month: 3 },
  });

  console.log(`Seeded ${PRODLIKE_DB_NAME}: /b/${PRODLIKE_SLUG}, known phone ${PRODLIKE_KNOWN_PHONE}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('seed:prodlike failed:', err);
  process.exit(1);
});
