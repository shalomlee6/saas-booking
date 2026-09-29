/**
 * Dev-only fixture accounts for manual/browser verification — run with
 * `npm run seed:dev`. Never touches real user data: every document it creates
 * or resets is scoped to a fixed, recognizable set of test identities (the
 * `@example.test` email domain, a fixed business slug). Safe to re-run —
 * it resets those specific accounts rather than accumulating duplicates.
 *
 * Refuses to run when NODE_ENV=production.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { validateEnv } from '../config/env';
import { connectDB } from '../config/db';
import { User } from '../models/User';
import { Business } from '../models/Business';
import { BusinessSettings } from '../models/BusinessSettings';
import { Service } from '../models/Service';
import { Customer } from '../models/Customer';
import { provisionTenant } from '../utils/provisionTenant';

const SUPER_ADMIN_EMAIL_FALLBACK = 'dev-super-admin@example.test';
const SUPER_ADMIN_PASSWORD = 'DevSuperAdmin123!';

const OWNER_EMAIL = 'dev-owner@example.test';
const OWNER_PASSWORD = 'DevOwner123!';
const OWNER_BUSINESS_NAME = 'Dev Test Business';
const OWNER_BUSINESS_SLUG = 'dev-test-business';

const STAFF_EMAIL = 'dev-staff@example.test';
const STAFF_PASSWORD = 'DevStaff123!';

const CUSTOMER_PHONE = '0500000000';
const CUSTOMER_NAME = 'Dev Test Customer';

/** Every identity this script ever creates, deletes, or resets must match this. */
const FIXTURE_EMAIL_SUFFIX = '@example.test';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

/** Defense in depth beyond NODE_ENV: refuse anything that isn't an obviously-local
 *  MongoDB (127.0.0.1/localhost). Catches "NODE_ENV=development pointed at a shared
 *  staging or prod cluster" — the exact class of mistake this hardening is for.
 *  Parses the URI and checks the actual hostname exactly, rather than an unanchored
 *  regex — "mongodb+srv://user:127.0.0.1-lookalike@prod-cluster.example.net/db" must
 *  NOT pass just because "127.0.0.1" appears somewhere in the string. */
function assertLocalMongo(uri: string): void {
  let hostname = '';
  try {
    hostname = new URL(uri).hostname.toLowerCase().replace(/^\[|\]$/g, '');
  } catch {
    // Unparseable URI — fails closed below (empty hostname is never local).
  }
  const isLocal = LOCAL_HOSTNAMES.has(hostname);
  if (!isLocal) {
    console.error(
      `Refusing to run seed:dev — MONGO_URI does not look like a local database:\n  ${uri}\n` +
        'This script deletes and recreates fixture accounts; only run it against your own local MongoDB.'
    );
    process.exit(1);
  }
}

/** Every delete/overwrite this script performs must be scoped to a fixture email —
 *  never a value read from live config (SUPER_ADMIN_EMAILS, etc.). This is what
 *  actually failed once already: reusing a real allow-listed email overwrote a real
 *  account. Keep this assertion even though the callers below are already hardcoded. */
function assertFixtureEmail(email: string): void {
  if (!email.endsWith(FIXTURE_EMAIL_SUFFIX)) {
    throw new Error(
      `Refusing to touch "${email}" — seed:dev only ever operates on ${FIXTURE_EMAIL_SUFFIX} addresses.`
    );
  }
}

async function seedSuperAdmin(): Promise<{ email: string; listedInAllowlist: boolean }> {
  // Always the dedicated fixture email — never an address already in
  // SUPER_ADMIN_EMAILS, since that could be a real account this script has no
  // business deleting or resetting the password on.
  const email = SUPER_ADMIN_EMAIL_FALLBACK;
  assertFixtureEmail(email);
  const allowlist = validateEnv().superAdminEmails;

  await User.deleteOne({ email });
  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
  await User.create({ email, passwordHash, role: 'super_admin', status: 'active' });

  return { email, listedInAllowlist: allowlist.includes(email) };
}

async function seedOwnerAndBusiness(): Promise<void> {
  assertFixtureEmail(OWNER_EMAIL);
  assertFixtureEmail(STAFF_EMAIL);
  const existingBusiness = await Business.findOne({ slug: OWNER_BUSINESS_SLUG });
  if (existingBusiness) {
    await Service.deleteMany({ businessId: existingBusiness._id });
    await BusinessSettings.deleteMany({ businessId: existingBusiness._id });
    await Customer.deleteMany({ businessId: existingBusiness._id });
    await User.deleteMany({ businessId: existingBusiness._id });
    await Business.deleteOne({ _id: existingBusiness._id });
  }
  await User.deleteOne({ email: OWNER_EMAIL });
  await User.deleteOne({ email: STAFF_EMAIL });

  const result = await provisionTenant({
    businessName: OWNER_BUSINESS_NAME,
    ownerFullName: 'Dev Owner',
    ownerEmail: OWNER_EMAIL,
    plan: 'pro',
    timezone: 'Asia/Jerusalem',
    businessSlug: OWNER_BUSINESS_SLUG,
    ownerPassword: OWNER_PASSWORD,
  });

  await Customer.create({
    businessId: result.businessId,
    name: CUSTOMER_NAME,
    firstName: 'Dev',
    lastName: 'Customer',
    phone: CUSTOMER_PHONE,
  });

  // A staff account on the same business — used to verify that a deleted
  // owner's cascade also invalidates the sessions of everyone else on that
  // business, not just the owner.
  const staffPasswordHash = await bcrypt.hash(STAFF_PASSWORD, 10);
  await User.create({
    email: STAFF_EMAIL,
    passwordHash: staffPasswordHash,
    role: 'staff',
    status: 'active',
    businessId: result.businessId,
    name: 'Dev Staff',
  });
}

async function main(): Promise<void> {
  const env = validateEnv();
  if (env.NODE_ENV === 'production') {
    console.error('Refusing to run seed:dev against a production environment.');
    process.exit(1);
  }
  assertLocalMongo(env.MONGO_URI);

  await connectDB(env.MONGO_URI, env.NODE_ENV);

  const superAdmin = await seedSuperAdmin();
  await seedOwnerAndBusiness();

  console.log('\nDev fixtures seeded:\n');
  console.log('Super admin');
  console.log(`  email:    ${superAdmin.email}`);
  console.log(`  password: ${SUPER_ADMIN_PASSWORD}`);
  if (!superAdmin.listedInAllowlist) {
    console.log(
      `  ⚠️  Not in SUPER_ADMIN_EMAILS — add it to .env: SUPER_ADMIN_EMAILS=${superAdmin.email}`
    );
  }
  console.log('\nOwner');
  console.log(`  email:    ${OWNER_EMAIL}`);
  console.log(`  password: ${OWNER_PASSWORD}`);
  console.log(`  business: ${OWNER_BUSINESS_NAME}  (slug: ${OWNER_BUSINESS_SLUG})`);
  console.log('\nStaff (same business as the owner above)');
  console.log(`  email:    ${STAFF_EMAIL}`);
  console.log(`  password: ${STAFF_PASSWORD}`);
  console.log('\nCustomer (public site, OTP login — no password)');
  console.log(`  phone:    ${CUSTOMER_PHONE}`);
  console.log(`  site:     /b/${OWNER_BUSINESS_SLUG}`);
  console.log(
    '  OTP code: 123456 — requires PUBLIC_DEV_OTP_BYPASS=true in .env (never set this in production)'
  );
  console.log('');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('seed:dev failed:', err);
  process.exit(1);
});
