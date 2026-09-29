import mongoose, { Types } from 'mongoose';
import type { IUser } from '../models/User';
import { User } from '../models/User';
import { Business } from '../models/Business';
import { BusinessSettings } from '../models/BusinessSettings';
import { Service } from '../models/Service';
import { Appointment } from '../models/Appointment';
import { Customer } from '../models/Customer';
import { CustomerServiceConfig } from '../models/CustomerServiceConfig';
import { AvailabilityOverride } from '../models/AvailabilityOverride';
import { BusinessReview } from '../models/BusinessReview';
import { OtpChallenge } from '../models/OtpChallenge';
import { PasswordResetToken } from '../models/PasswordResetToken';
import { countBusinessUploadFiles, deleteBusinessUploads } from './deleteBusinessUploads';
import { logger } from './logger';

export interface DeleteImpactCounts {
  appointments: number;
  customers: number;
  services: number;
  staffUsers: number;
  reviews: number;
  availabilityOverrides: number;
  customerServiceConfigs: number;
  uploadedFiles: number;
}

export interface DeleteImpact {
  business: { id: string; name: string; slug: string } | null;
  counts: DeleteImpactCounts;
}

const EMPTY_COUNTS: DeleteImpactCounts = {
  appointments: 0,
  customers: 0,
  services: 0,
  staffUsers: 0,
  reviews: 0,
  availabilityOverrides: 0,
  customerServiceConfigs: 0,
  uploadedFiles: 0,
};

/** Read-only — what deleting this user would cascade-delete. Populates the confirmation dialog.
 *  Only the business OWNER's deletion cascades to the whole business — a staff account has
 *  `businessId` set too (they belong to it), but deleting one must never take the business,
 *  its data, or its other staff (including the owner) down with it. */
export async function computeDeleteImpact(user: IUser): Promise<DeleteImpact> {
  if (!user.businessId) {
    return { business: null, counts: EMPTY_COUNTS };
  }
  const businessId = user.businessId;
  const business = await Business.findById(businessId).select('name slug ownerId').lean();
  if (!business || business.ownerId.toString() !== user._id.toString()) {
    return { business: null, counts: EMPTY_COUNTS };
  }
  const [
    appointments,
    customers,
    services,
    staffUsers,
    reviews,
    availabilityOverrides,
    customerServiceConfigs,
    uploadedFiles,
  ] = await Promise.all([
    Appointment.countDocuments({ businessId }),
    Customer.countDocuments({ businessId }),
    Service.countDocuments({ businessId }),
    User.countDocuments({ businessId, _id: { $ne: user._id } }),
    BusinessReview.countDocuments({ businessId }),
    AvailabilityOverride.countDocuments({ businessId }),
    CustomerServiceConfig.countDocuments({ businessId }),
    countBusinessUploadFiles(businessId.toString()),
  ]);
  return {
    business: { id: business._id.toString(), name: business.name, slug: business.slug },
    counts: {
      appointments,
      customers,
      services,
      staffUsers,
      reviews,
      availabilityOverrides,
      customerServiceConfigs,
      uploadedFiles,
    },
  };
}

export interface DeleteResult {
  usedTransaction: boolean;
  deletedBusiness: boolean;
  counts: DeleteImpactCounts;
}

const NO_TRANSACTION_SUPPORT = /Transaction numbers are only allowed on a replica set member or mongos/i;

/**
 * Deletes a user and, if they own a business, every document scoped to that
 * business — no orphans left behind (appointments, customers, services,
 * business settings, reviews, availability overrides, per-customer service
 * overrides, other staff accounts on that business, its OTP challenges, and
 * the business itself). Audit log entries are deliberately left alone — an
 * audit trail that gets rewritten on delete isn't a trail.
 *
 * Uses a real MongoDB transaction when the deployment supports one (a
 * replica set — which is what Atlas and any production-grade MongoDB is).
 * A plain standalone `mongod` (a common local-dev setup) doesn't support
 * multi-document transactions at all; in that case this falls back to a
 * plain sequential delete in dependency order (business-scoped data first,
 * the user itself last), so a mid-way failure never leaves a dangling
 * business with no owner — the account remains and the operation is safely
 * retriable. `usedTransaction` on the result tells the caller which path ran.
 */
export async function deleteUserCascade(user: IUser): Promise<DeleteResult> {
  const impact = await computeDeleteImpact(user);
  const businessId = impact.business ? new Types.ObjectId(impact.business.id) : null;
  const businessSlug = impact.business?.slug ?? null;

  // Sequential, not Promise.all: a MongoDB driver session (used for the
  // transaction path below) is not safe to share across concurrently
  // in-flight operations — running these in parallel silently races them
  // against the same session.
  const run = async (session: mongoose.ClientSession | undefined): Promise<void> => {
    const opts = session ? { session } : {};
    if (businessId) {
      await Appointment.deleteMany({ businessId }, opts);
      await Customer.deleteMany({ businessId }, opts);
      await Service.deleteMany({ businessId }, opts);
      await BusinessSettings.deleteMany({ businessId }, opts);
      await BusinessReview.deleteMany({ businessId }, opts);
      await AvailabilityOverride.deleteMany({ businessId }, opts);
      await CustomerServiceConfig.deleteMany({ businessId }, opts);
      await User.deleteMany({ businessId, _id: { $ne: user._id } }, opts);
      if (businessSlug) {
        await OtpChallenge.deleteMany({ businessSlug }, opts);
      }
      await Business.deleteOne({ _id: businessId }, opts);
    }
    await PasswordResetToken.deleteMany({ userId: user._id }, opts);
    await User.deleteOne({ _id: user._id }, opts);
  };

  const session = await mongoose.startSession();
  try {
    try {
      await session.withTransaction(() => run(session));
      if (businessId) await deleteBusinessUploads(businessId.toString());
      return { usedTransaction: true, deletedBusiness: !!businessId, counts: impact.counts };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!NO_TRANSACTION_SUPPORT.test(message)) throw err;
      logger.warn('delete_user_transaction_unsupported_falling_back', { userId: user._id.toString() });
      await run(undefined);
      if (businessId) await deleteBusinessUploads(businessId.toString());
      return { usedTransaction: false, deletedBusiness: !!businessId, counts: impact.counts };
    }
  } finally {
    await session.endSession();
  }
}
