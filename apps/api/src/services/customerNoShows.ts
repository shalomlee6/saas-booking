import { Appointment } from '../models/Appointment';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';

export interface NoShowPolicy {
  enabled: boolean;
  threshold: number;
}

const DEFAULT_POLICY: NoShowPolicy = { enabled: true, threshold: 3 };

/** Missing policy on older settings documents uses the product defaults. */
export function resolveNoShowPolicy(
  source: { noShowPolicy?: { enabled?: boolean; threshold?: number } | null } | null | undefined
): NoShowPolicy {
  const raw = source?.noShowPolicy;
  const threshold = raw?.threshold;
  const thresholdOk =
    typeof threshold === 'number' && Number.isInteger(threshold) && threshold >= 1 && threshold <= 20;
  return {
    enabled: raw?.enabled !== false,
    threshold: thresholdOk ? threshold : DEFAULT_POLICY.threshold,
  };
}

/**
 * Canonical no-show window. A no-show counts when its start is after `noShowResetAt`.
 * An unset reset means every stored no-show counts.
 */
export function noShowAppointmentFilter(noShowResetAt?: Date | null): Record<string, unknown> {
  const filter: Record<string, unknown> = { status: 'no_show' };
  if (noShowResetAt) filter.start = { $gt: noShowResetAt };
  return filter;
}

/** List-pipeline expression. The customer document supplies `noShowResetAt`; appointments are `$appointments`. */
export function noShowCountAggregationExpression(): Record<string, unknown> {
  return {
    $size: {
      $filter: {
        input: '$appointments',
        as: 'a',
        cond: {
          $and: [
            { $eq: ['$$a.status', 'no_show'] },
            {
              $or: [
                { $eq: [{ $ifNull: ['$noShowResetAt', null] }, null] },
                { $gt: ['$$a.start', '$noShowResetAt'] },
              ],
            },
          ],
        },
      },
    },
  };
}

export function isBlockedByNoShowPolicy(policy: NoShowPolicy, noShowCount: number): boolean {
  return policy.enabled && noShowCount >= policy.threshold;
}

export async function countCustomerNoShows(
  businessId: string,
  customerId: string,
  noShowResetAt?: Date | null
): Promise<number> {
  return Appointment.countDocuments({
    businessId,
    customerId,
    ...noShowAppointmentFilter(noShowResetAt),
  });
}

export async function readNoShowPolicy(businessId: string): Promise<NoShowPolicy> {
  const settings = await ensureBusinessSettings(businessId);
  return resolveNoShowPolicy(settings);
}

export async function saveNoShowPolicy(
  businessId: string,
  next: NoShowPolicy
): Promise<{
  changed: boolean;
  previous: NoShowPolicy;
  current: NoShowPolicy;
  settingsId: string;
}> {
  const settings = await ensureBusinessSettings(businessId);
  const previous = resolveNoShowPolicy(settings);
  const current: NoShowPolicy = { enabled: next.enabled, threshold: next.threshold };
  const changed = previous.enabled !== current.enabled || previous.threshold !== current.threshold;
  if (changed) {
    settings.noShowPolicy = current;
    await settings.save();
  }
  return { changed, previous, current, settingsId: settings._id.toString() };
}
