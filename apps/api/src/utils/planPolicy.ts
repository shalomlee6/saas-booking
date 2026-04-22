import { Types } from 'mongoose';
import { User } from '../models/User';
import { Service } from '../models/Service';
import { BusinessSettings } from '../models/BusinessSettings';
import { Business } from '../models/Business';

/** Canonical tiers. Legacy DB value `normal` maps to `pro`. */
export type PlanTier = 'free' | 'pro' | 'premium';

export function normalizePlan(raw: string | undefined | null): PlanTier {
  if (raw === 'premium') return 'premium';
  if (raw === 'pro' || raw === 'normal') return 'pro';
  return 'free';
}

export interface PlanLimits {
  /** null = unlimited */
  maxStaff: number | null;
  maxServices: number | null;
  analyticsEnabled: boolean;
  customDomainEnabled: boolean;
}

export function limitsFor(plan: PlanTier): PlanLimits {
  switch (plan) {
    case 'premium':
      return {
        maxStaff: null,
        maxServices: null,
        analyticsEnabled: true,
        customDomainEnabled: true,
      };
    case 'pro':
      return {
        maxStaff: 5,
        maxServices: 10,
        analyticsEnabled: true,
        customDomainEnabled: false,
      };
    case 'free':
    default:
      return {
        maxStaff: 1,
        maxServices: 2,
        analyticsEnabled: false,
        customDomainEnabled: false,
      };
  }
}

export function planUpgradeMessage(plan: PlanTier, feature: string): string {
  return `This action requires a higher plan. Current plan: ${plan}. ${feature}. Please upgrade to continue.`;
}

async function loadPlanForBusiness(businessId: Types.ObjectId): Promise<PlanTier> {
  const b = await Business.findById(businessId).select('plan').lean();
  if (b && typeof (b as { plan?: string }).plan === 'string') {
    return normalizePlan((b as { plan?: string }).plan);
  }
  const s = await BusinessSettings.findOne({ businessId }).select('plan').lean();
  return normalizePlan(s?.plan);
}

export async function assertCanCreateService(businessId: Types.ObjectId): Promise<void> {
  const plan = await loadPlanForBusiness(businessId);
  const { maxServices } = limitsFor(plan);
  if (maxServices == null) return;
  const count = await Service.countDocuments({ businessId });
  if (count >= maxServices) {
    const err = new Error(planUpgradeMessage(plan, 'Service limit reached'));
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}

export async function assertCanCreateStaffUser(businessId: Types.ObjectId): Promise<void> {
  const plan = await loadPlanForBusiness(businessId);
  const { maxStaff } = limitsFor(plan);
  if (maxStaff == null) return;
  const count = await User.countDocuments({ businessId, role: 'staff' });
  if (count >= maxStaff) {
    const err = new Error(planUpgradeMessage(plan, 'Staff seat limit reached'));
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}

export async function assertTenantAnalyticsAllowed(businessId: Types.ObjectId): Promise<void> {
  const plan = await loadPlanForBusiness(businessId);
  const settings = await BusinessSettings.findOne({ businessId }).select('features').lean();
  const analyticsOn =
    settings?.features &&
    typeof (settings.features as { analyticsEnabled?: boolean }).analyticsEnabled === 'boolean'
      ? (settings.features as { analyticsEnabled: boolean }).analyticsEnabled
      : limitsFor(plan).analyticsEnabled;
  if (!analyticsOn) {
    const err = new Error(planUpgradeMessage(plan, 'Analytics is not included on your plan'));
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}
