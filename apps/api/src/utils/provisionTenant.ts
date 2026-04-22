import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { Business } from '../models/Business';
import { User } from '../models/User';
import { BusinessSettings, type IOpeningHours } from '../models/BusinessSettings';
import { Service } from '../models/Service';
import { ensureBusinessSettings } from './ensureBusinessSettings';
import { generateSlug, normalizeBusinessSlugInput } from './slug';
import type { PlanTier } from './planPolicy';
import { limitsFor } from './planPolicy';
import type { SettingsPlan } from '../dto/enums';

export interface ProvisionTenantInput {
  businessName: string;
  ownerFullName: string;
  ownerEmail: string;
  ownerPhone?: string;
  plan: PlanTier;
  timezone: string;
  /** Optional explicit slug; must be unique. */
  businessSlug?: string;
  /** Optional password (min 8); otherwise auto-generated. */
  ownerPassword?: string;
}

export function settingsPlanFromTier(plan: PlanTier): SettingsPlan {
  if (plan === 'premium') return 'premium';
  if (plan === 'pro') return 'pro';
  return 'free';
}

function buildFeaturesForPlan(plan: PlanTier) {
  const L = limitsFor(plan);
  return {
    bookingEnabled: true,
    paymentsEnabled: plan !== 'free',
    marketingModule: plan !== 'free',
    chatModule: plan === 'premium',
    waitlistEnabled: plan !== 'free',
    analyticsEnabled: L.analyticsEnabled,
    customDomainEnabled: L.customDomainEnabled,
  };
}

/**
 * Updates canonical plan on Business and mirrors plan + feature flags on BusinessSettings.
 */
export async function syncBusinessPlanDocuments(
  businessId: Types.ObjectId,
  plan: PlanTier
): Promise<void> {
  await ensureBusinessSettings(businessId);
  const features = buildFeaturesForPlan(plan);
  const settingsPlan = settingsPlanFromTier(plan);
  await Business.updateOne({ _id: businessId }, { $set: { plan } });
  await BusinessSettings.updateOne(
    { businessId },
    { $set: { plan: settingsPlan, features } }
  );
}

function provisionOpeningHours(): IOpeningHours {
  return {
    slotStepMinutes: 30,
    days: [
      { day: 0, isOpen: true, ranges: [{ start: '09:00', end: '17:00' }] },
      { day: 1, isOpen: true, ranges: [{ start: '09:00', end: '17:00' }] },
      { day: 2, isOpen: true, ranges: [{ start: '09:00', end: '17:00' }] },
      { day: 3, isOpen: true, ranges: [{ start: '09:00', end: '17:00' }] },
      { day: 4, isOpen: true, ranges: [{ start: '09:00', end: '17:00' }] },
      { day: 5, isOpen: true, ranges: [{ start: '09:00', end: '13:00' }] },
      { day: 6, isOpen: false, ranges: [] },
    ],
  };
}

export interface ProvisionTenantResult {
  tempPassword: string;
  businessId: Types.ObjectId;
  ownerId: Types.ObjectId;
  settingsId: Types.ObjectId;
  serviceId: Types.ObjectId;
}

/**
 * Creates owner user, business, settings, and default service in one flow.
 * Rolls back created documents (best-effort) if any step fails.
 */
export async function provisionTenant(input: ProvisionTenantInput): Promise<ProvisionTenantResult> {
  const rawPw = input.ownerPassword?.trim();
  const tempPassword =
    rawPw && rawPw.length >= 8 ? rawPw : crypto.randomBytes(9).toString('base64url');
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  let userId: Types.ObjectId | null = null;
  let businessId: Types.ObjectId | null = null;

  const email = input.ownerEmail.toLowerCase().trim();

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const err = new Error('Email already registered');
    (err as Error & { status: number }).status = 409;
    throw err;
  }

  let slug: string;
  const custom = input.businessSlug?.trim() ? normalizeBusinessSlugInput(input.businessSlug) : '';
  if (custom) {
    if (custom.length < 2) {
      const err = new Error('Slug must be at least 2 characters');
      (err as Error & { status: number }).status = 400;
      throw err;
    }
    const taken = await Business.findOne({ slug: custom });
    if (taken) {
      const err = new Error('Slug is already taken');
      (err as Error & { status: number }).status = 409;
      throw err;
    }
    slug = custom;
  } else {
    const baseSlug = generateSlug(input.businessName);
    slug = baseSlug || 'business';
    let counter = 1;
    while (await Business.findOne({ slug })) {
      slug = `${baseSlug || 'business'}-${counter}`;
      counter += 1;
    }
  }

  try {
    const user = await User.create({
      email,
      passwordHash,
      name: input.ownerFullName.trim(),
      phone: input.ownerPhone?.trim() || undefined,
      role: 'owner',
      status: 'active',
    });
    userId = user._id as Types.ObjectId;

    const business = await Business.create({
      name: input.businessName.trim(),
      slug,
      ownerId: userId,
      plan: input.plan,
      phone: input.ownerPhone?.trim() || undefined,
    });
    businessId = business._id as Types.ObjectId;

    user.businessId = businessId;
    await user.save();

    const features = buildFeaturesForPlan(input.plan);
    const settings = await BusinessSettings.create({
      businessId,
      plan: settingsPlanFromTier(input.plan),
      features,
      localization: {
        language: 'he',
        timezone: input.timezone.trim() || 'Asia/Jerusalem',
        currency: 'ILS',
      },
      openingHours: provisionOpeningHours(),
      bookingWelcomeMessage: 'Book an appointment with us',
    });

    const service = await Service.create({
      businessId,
      name: 'Consultation',
      durationMinutes: 60,
      price: 0,
      isActive: true,
    });

    console.info('[provisionTenant] Welcome email (mock):', {
      to: email,
      temporaryPassword: tempPassword,
      businessName: input.businessName.trim(),
      slug,
    });

    return {
      tempPassword,
      businessId,
      ownerId: userId,
      settingsId: settings._id as Types.ObjectId,
      serviceId: service._id as Types.ObjectId,
    };
  } catch (err) {
    if (businessId) {
      await Service.deleteMany({ businessId });
      await BusinessSettings.deleteMany({ businessId });
      await Business.deleteOne({ _id: businessId });
    }
    if (userId) {
      await User.deleteOne({ _id: userId });
    }
    throw err;
  }
}
