/**
 * Local-only phone backfill.
 * Already-canonical rows are left untouched.
 * Rows that canonicalize to a different string are rewritten.
 * Rows that do not canonicalize are listed and not rewritten.
 *
 * Shape count for Atlas (run before any backfill):
 *
 * db.customers.aggregate([
 *   { $project: {
 *       len: { $strLenCP: { $ifNull: ['$phone', ''] } },
 *       localMobile: { $regexMatch: { input: { $ifNull: ['$phone', ''] }, regex: /^05\d{8}$/ } },
 *       digitsOnly: { $regexMatch: { input: { $ifNull: ['$phone', ''] }, regex: /^\d+$/ } },
 *   }},
 *   { $group: { _id: { len: '$len', localMobile: '$localMobile', digitsOnly: '$digitsOnly' }, count: { $sum: 1 } } },
 *   { $sort: { count: -1 } },
 * ])
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { validateEnv } from '../config/env';
import { connectDB } from '../config/db';
import { Customer } from '../models/Customer';
import { canonicalLocalPhone } from '../listQuery/search';

function assertLocalMongo(uri: string): void {
  let hostname = '';
  try {
    hostname = new URL(uri).hostname.toLowerCase().replace(/^\[|\]$/g, '');
  } catch {
    hostname = '';
  }
  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') {
    throw new Error('Refusing to backfill phones against a non-local MongoDB');
  }
}

function mask(phone: string): string {
  return phone.replace(/\d/g, '0');
}

async function main(): Promise<void> {
  const env = validateEnv();
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to backfill phones when NODE_ENV=production');
  }
  assertLocalMongo(env.MONGO_URI);
  await connectDB(env.MONGO_URI, env.NODE_ENV);

  const customers = await Customer.find().select('_id businessId phone').lean();
  const shapes = new Map<string, number>();
  const manual: { id: string; businessId: string; mask: string; length: number }[] = [];
  let rewritten = 0;
  let unchanged = 0;

  for (const customer of customers) {
    const phone = customer.phone ?? '';
    const canonical = canonicalLocalPhone(phone);
    const shape = canonical ? 'canonical-mobile' : `unnormalized-len-${phone.length}`;
    shapes.set(shape, (shapes.get(shape) ?? 0) + 1);
    if (canonical === phone) {
      unchanged += 1;
      continue;
    }
    if (!canonical) {
      manual.push({
        id: customer._id.toString(),
        businessId: customer.businessId.toString(),
        mask: mask(phone),
        length: phone.length,
      });
      continue;
    }
    await Customer.updateOne({ _id: customer._id }, { $set: { phone: canonical } });
    rewritten += 1;
  }

  const duplicates = await Customer.aggregate<{ _id: { businessId: unknown; phone: string }; count: number }>([
    { $group: { _id: { businessId: '$businessId', phone: '$phone' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  console.log(JSON.stringify({
    total: customers.length,
    unchanged,
    rewritten,
    shapes: Object.fromEntries(shapes),
    manualFix: manual,
    duplicateGroups: duplicates.map((row) => ({
      businessId: String(row._id.businessId),
      phoneMask: mask(row._id.phone),
      count: row.count,
    })),
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
