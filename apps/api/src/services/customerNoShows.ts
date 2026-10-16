import { Types } from 'mongoose';
import { Appointment } from '../models/Appointment';
import { AuditLog } from '../models/AuditLog';
import { Customer } from '../models/Customer';
import { NotFoundError, ValidationError } from '../errors/httpErrors';
import { recordAudit } from '../utils/recordAudit';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';

export interface NoShowPolicy {
  enabled: boolean;
  threshold: number;
}

export type ReliabilityKind = 'no_show' | 'late_cancellation' | 'late_arrival';
export type Lookback = '12months' | 'all';

export interface ReliabilityPolicy {
  noShow: NoShowPolicy;
  lateCancellation: NoShowPolicy;
  lateArrival: NoShowPolicy;
  lookback: Lookback;
}

export interface ReliabilityCounts {
  noShow: number;
  lateCancellation: number;
  lateArrival: number;
}

export type BookingOverride = 'auto' | 'allow' | 'block';
export type BlockReason = 'threshold' | 'manual' | 'allowed' | 'clear';

const DEFAULT_POLICY: NoShowPolicy = { enabled: true, threshold: 3 };

const CONTROL_ACTIONS = [
  'appointment.no_show_excused',
  'appointment.no_show_unexcused',
  'appointment.late_cancellation_excused',
  'appointment.late_cancellation_unexcused',
  'appointment.late_arrival_excused',
  'appointment.late_arrival_unexcused',
  'customer.no_shows_excused',
  'customer.booking_override_updated',
] as const;

export interface NoShowActor {
  userId?: string;
  email?: string;
}

export interface BookingBlock {
  blocked: boolean;
  reason: BlockReason;
}

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

export function normalizeBookingOverride(value: unknown): BookingOverride {
  return value === 'allow' || value === 'block' ? value : 'auto';
}

function resolveCounter(
  raw: { enabled?: boolean; threshold?: number } | null | undefined,
  defaultEnabled: boolean
): NoShowPolicy {
  const threshold = raw?.threshold;
  const thresholdOk =
    typeof threshold === 'number' && Number.isInteger(threshold) && threshold >= 1 && threshold <= 20;
  return {
    enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : defaultEnabled,
    threshold: thresholdOk ? threshold : DEFAULT_POLICY.threshold,
  };
}

/** No-show keeps its existing default. The new counters stay off until an owner enables them. */
export function resolveReliabilityPolicy(
  source: {
    noShowPolicy?: { enabled?: boolean; threshold?: number } | null;
    reliability?: {
      lateCancellation?: { enabled?: boolean; threshold?: number } | null;
      lateArrival?: { enabled?: boolean; threshold?: number } | null;
      lookback?: string | null;
    } | null;
  } | null | undefined
): ReliabilityPolicy {
  return {
    noShow: resolveNoShowPolicy(source),
    lateCancellation: resolveCounter(source?.reliability?.lateCancellation, false),
    lateArrival: resolveCounter(source?.reliability?.lateArrival, false),
    lookback: source?.reliability?.lookback === 'all' ? 'all' : '12months',
  };
}

export function lookbackCutoff(lookback: Lookback, now = new Date()): Date | null {
  if (lookback === 'all') return null;
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - 12);
  return cutoff;
}

/**
 * One rule for every caller.
 * `allow` is never blocked. `block` is always blocked.
 * `auto` is blocked when any enabled counter reaches its threshold inside the lookback.
 */
export function resolveBookingBlock(
  override: BookingOverride,
  policy: ReliabilityPolicy,
  counts: ReliabilityCounts
): BookingBlock {
  if (override === 'allow') return { blocked: false, reason: 'allowed' };
  if (override === 'block') return { blocked: true, reason: 'manual' };
  const hit =
    (policy.noShow.enabled && counts.noShow >= policy.noShow.threshold) ||
    (policy.lateCancellation.enabled && counts.lateCancellation >= policy.lateCancellation.threshold) ||
    (policy.lateArrival.enabled && counts.lateArrival >= policy.lateArrival.threshold);
  if (hit) return { blocked: true, reason: 'threshold' };
  return { blocked: false, reason: 'clear' };
}

/** Canonical count: status `no_show` and not excused. Missing flag counts as not excused. */
export function noShowAppointmentFilter(): Record<string, unknown> {
  return { status: 'no_show', noShowExcused: { $ne: true } };
}

/** List-pipeline expression. Appointments are `$appointments`. */
export function noShowCountAggregationExpression(): Record<string, unknown> {
  return {
    $size: {
      $filter: {
        input: '$appointments',
        as: 'a',
        cond: {
          $and: [{ $eq: ['$$a.status', 'no_show'] }, { $ne: ['$$a.noShowExcused', true] }],
        },
      },
    },
  };
}

function eventCountExpression(conds: Record<string, unknown>[], cutoff: Date | null): Record<string, unknown> {
  const parts = [...conds];
  if (cutoff) parts.push({ $gte: ['$$a.start', cutoff] });
  return {
    $size: {
      $filter: {
        input: '$appointments',
        as: 'a',
        cond: { $and: parts },
      },
    },
  };
}

export function reliabilityCountExpressions(policy: ReliabilityPolicy, now = new Date()): {
  noShowCount: Record<string, unknown>;
  lateCancellationCount: Record<string, unknown>;
  lateArrivalCount: Record<string, unknown>;
} {
  const cutoff = lookbackCutoff(policy.lookback, now);
  return {
    noShowCount: eventCountExpression(
      [{ $eq: ['$$a.status', 'no_show'] }, { $ne: ['$$a.noShowExcused', true] }],
      cutoff
    ),
    lateCancellationCount: eventCountExpression(
      [{ $eq: ['$$a.lateCancellation', true] }, { $ne: ['$$a.lateCancellationExcused', true] }],
      cutoff
    ),
    lateArrivalCount: eventCountExpression(
      [{ $eq: ['$$a.lateArrival', true] }, { $ne: ['$$a.lateArrivalExcused', true] }],
      cutoff
    ),
  };
}

/** Aggregation expression. Reads the stored override and the already-computed counts. */
export function bookingBlockedExpression(policy: ReliabilityPolicy): Record<string, unknown> {
  const override = { $ifNull: ['$bookingOverride', 'auto'] };
  const hits: Record<string, unknown>[] = [];
  if (policy.noShow.enabled) hits.push({ $gte: ['$noShowCount', policy.noShow.threshold] });
  if (policy.lateCancellation.enabled) {
    hits.push({ $gte: ['$lateCancellationCount', policy.lateCancellation.threshold] });
  }
  if (policy.lateArrival.enabled) hits.push({ $gte: ['$lateArrivalCount', policy.lateArrival.threshold] });
  const byThreshold = hits.length === 0 ? false : hits.length === 1 ? hits[0] : { $or: hits };
  return {
    $switch: {
      branches: [
        { case: { $eq: [override, 'allow'] }, then: false },
        { case: { $eq: [override, 'block'] }, then: true },
      ],
      default: byThreshold,
    },
  };
}

export async function countReliability(
  businessId: string,
  customerId: string,
  policy: ReliabilityPolicy,
  now = new Date()
): Promise<ReliabilityCounts> {
  const cutoff = lookbackCutoff(policy.lookback, now);
  const base: Record<string, unknown> = {
    businessId,
    customerId,
    ...(cutoff ? { start: { $gte: cutoff } } : {}),
  };
  const [noShow, lateCancellation, lateArrival] = await Promise.all([
    Appointment.countDocuments({ ...base, ...noShowAppointmentFilter() }),
    Appointment.countDocuments({ ...base, lateCancellation: true, lateCancellationExcused: { $ne: true } }),
    Appointment.countDocuments({ ...base, lateArrival: true, lateArrivalExcused: { $ne: true } }),
  ]);
  return { noShow, lateCancellation, lateArrival };
}

export async function evaluateBookingBlock(
  businessId: string,
  customerId: string,
  override: unknown,
  settings: Parameters<typeof resolveReliabilityPolicy>[0]
): Promise<{ block: BookingBlock; counts: ReliabilityCounts; policy: ReliabilityPolicy }> {
  const policy = resolveReliabilityPolicy(settings);
  const counts = await countReliability(businessId, customerId, policy);
  return {
    policy,
    counts,
    block: resolveBookingBlock(normalizeBookingOverride(override), policy, counts),
  };
}

export async function countCustomerNoShows(businessId: string, customerId: string): Promise<number> {
  return Appointment.countDocuments({
    businessId,
    customerId,
    ...noShowAppointmentFilter(),
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

export interface NoShowControlAppointment {
  id: string;
  start: Date;
  serviceName: string;
  excused: boolean;
  minutes?: number;
  excusedAt?: Date;
  excusedReason?: string;
}

export interface NoShowControlHistoryEntry {
  at: Date;
  action: string;
  reason?: string;
}

export interface NoShowControl {
  noShowCount: number;
  lateCancellationCount: number;
  lateArrivalCount: number;
  blocked: boolean;
  blockReason: BlockReason;
  bookingOverride: BookingOverride;
  policy: NoShowPolicy;
  reliability: ReliabilityPolicy;
  noShows: NoShowControlAppointment[];
  lateCancellations: NoShowControlAppointment[];
  lateArrivals: NoShowControlAppointment[];
  history: NoShowControlHistoryEntry[];
}

async function loadCustomer(businessId: string, customerId: string) {
  if (!Types.ObjectId.isValid(customerId)) throw new NotFoundError('Customer not found');
  const customer = await Customer.findOne({ _id: customerId, businessId });
  if (!customer) throw new NotFoundError('Customer not found');
  return customer;
}

async function reliabilityRows(
  customer: { businessId: Types.ObjectId; _id: Types.ObjectId },
  match: Record<string, unknown>,
  excusedField: 'noShowExcused' | 'lateCancellationExcused' | 'lateArrivalExcused'
) {
  return Appointment.aggregate<{
    _id: Types.ObjectId;
    start: Date;
    excused?: boolean;
    excusedAt?: Date;
    excusedReason?: string;
    serviceName?: string;
    lateArrivalMinutes?: number;
  }>([
    { $match: { businessId: customer.businessId, customerId: customer._id, ...match } },
    { $sort: { start: -1 } },
    { $lookup: { from: 'services', localField: 'serviceId', foreignField: '_id', as: 'service' } },
    {
      $project: {
        start: 1,
        excused: { $eq: [`$${excusedField}`, true] },
        excusedAt: 1,
        excusedReason: 1,
        lateArrivalMinutes: 1,
        serviceName: { $ifNull: [{ $arrayElemAt: ['$service.name', 0] }, ''] },
      },
    },
  ]);
}

function mapReliabilityRows(
  rows: {
    _id: Types.ObjectId;
    start: Date;
    excused?: boolean;
    excusedAt?: Date;
    excusedReason?: string;
    serviceName?: string;
    lateArrivalMinutes?: number;
  }[]
): NoShowControlAppointment[] {
  return rows.map((row) => ({
    id: row._id.toString(),
    start: row.start,
    serviceName: row.serviceName ?? '',
    excused: row.excused === true,
    ...(typeof row.lateArrivalMinutes === 'number' ? { minutes: row.lateArrivalMinutes } : {}),
    ...(row.excusedAt ? { excusedAt: row.excusedAt } : {}),
    ...(row.excusedReason ? { excusedReason: row.excusedReason } : {}),
  }));
}

export async function readNoShowControl(businessId: string, customerId: string): Promise<NoShowControl> {
  const customer = await loadCustomer(businessId, customerId);
  const settings = await ensureBusinessSettings(businessId);
  const evaluated = await evaluateBookingBlock(
    businessId,
    customerId,
    customer.bookingOverride,
    settings
  );
  const [noShowRows, lateCancelRows, lateArrivalRows] = await Promise.all([
    reliabilityRows(customer, { status: 'no_show' }, 'noShowExcused'),
    reliabilityRows(customer, { lateCancellation: true }, 'lateCancellationExcused'),
    reliabilityRows(customer, { lateArrival: true }, 'lateArrivalExcused'),
  ]);
  const history = await AuditLog.find({
    action: { $in: [...CONTROL_ACTIONS] },
    'metadata.businessId': businessId,
    $or: [{ entity: 'Customer', entityId: customerId }, { 'metadata.customerId': customerId }],
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return {
    noShowCount: evaluated.counts.noShow,
    lateCancellationCount: evaluated.counts.lateCancellation,
    lateArrivalCount: evaluated.counts.lateArrival,
    blocked: evaluated.block.blocked,
    blockReason: evaluated.block.reason,
    bookingOverride: normalizeBookingOverride(customer.bookingOverride),
    policy: evaluated.policy.noShow,
    reliability: evaluated.policy,
    noShows: mapReliabilityRows(noShowRows),
    lateCancellations: mapReliabilityRows(lateCancelRows),
    lateArrivals: mapReliabilityRows(lateArrivalRows),
    history: history.map((entry) => {
      const reason = entry.metadata?.reason;
      return {
        at: entry.createdAt,
        action: entry.action,
        ...(typeof reason === 'string' && reason.trim() ? { reason: reason.trim() } : {}),
      };
    }),
  };
}

function excuseField(kind: ReliabilityKind): 'noShowExcused' | 'lateCancellationExcused' | 'lateArrivalExcused' {
  if (kind === 'late_cancellation') return 'lateCancellationExcused';
  if (kind === 'late_arrival') return 'lateArrivalExcused';
  return 'noShowExcused';
}

function kindApplies(
  appointment: { status: string; lateCancellation?: boolean; lateArrival?: boolean },
  kind: ReliabilityKind
): boolean {
  if (kind === 'no_show') return appointment.status === 'no_show';
  if (kind === 'late_cancellation') return appointment.lateCancellation === true;
  return appointment.lateArrival === true;
}

export async function setNoShowExcused(
  businessId: string,
  customerId: string,
  appointmentId: string,
  excused: boolean,
  reason: string | undefined,
  actor: NoShowActor,
  kind: ReliabilityKind = 'no_show'
): Promise<NoShowControl> {
  const customer = await loadCustomer(businessId, customerId);
  if (!Types.ObjectId.isValid(appointmentId)) throw new NotFoundError('Appointment not found');
  const appointment = await Appointment.findOne({
    _id: appointmentId,
    businessId: customer.businessId,
    customerId: customer._id,
  });
  if (!appointment) throw new NotFoundError('Appointment not found');
  if (!kindApplies(appointment, kind)) {
    throw new ValidationError('This appointment cannot be excused for that event');
  }
  const field = excuseField(kind);
  const already = appointment[field] === true;
  if (already !== excused) {
    if (excused) {
      await Appointment.updateOne(
        { _id: appointment._id },
        {
          $set: {
            [field]: true,
            excusedAt: new Date(),
            ...(reason ? { excusedReason: reason } : {}),
          },
          ...(reason ? {} : { $unset: { excusedReason: '' } }),
        }
      );
    } else {
      await Appointment.updateOne(
        { _id: appointment._id },
        { $set: { [field]: false }, $unset: { excusedAt: '', excusedReason: '' } }
      );
    }
    const actionBase =
      kind === 'late_cancellation'
        ? 'appointment.late_cancellation'
        : kind === 'late_arrival'
          ? 'appointment.late_arrival'
          : 'appointment.no_show';
    await recordAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: excused ? `${actionBase}_excused` : `${actionBase}_unexcused`,
      entity: 'Appointment',
      entityId: appointmentId,
      metadata: {
        businessId,
        customerId,
        kind,
        ...(reason ? { reason } : {}),
      },
    });
  }
  return readNoShowControl(businessId, customerId);
}

export async function excuseAllNoShows(
  businessId: string,
  customerId: string,
  reason: string | undefined,
  actor: NoShowActor
): Promise<NoShowControl & { excused: number }> {
  const customer = await loadCustomer(businessId, customerId);
  const excuseSet = {
    excusedAt: new Date(),
    ...(reason ? { excusedReason: reason } : {}),
  };
  const [noShows, lateCancels, lateArrivals] = await Promise.all([
    Appointment.updateMany(
      {
        businessId: customer.businessId,
        customerId: customer._id,
        status: 'no_show',
        noShowExcused: { $ne: true },
      },
      { $set: { ...excuseSet, noShowExcused: true } }
    ),
    Appointment.updateMany(
      {
        businessId: customer.businessId,
        customerId: customer._id,
        lateCancellation: true,
        lateCancellationExcused: { $ne: true },
      },
      { $set: { ...excuseSet, lateCancellationExcused: true } }
    ),
    Appointment.updateMany(
      {
        businessId: customer.businessId,
        customerId: customer._id,
        lateArrival: true,
        lateArrivalExcused: { $ne: true },
      },
      { $set: { ...excuseSet, lateArrivalExcused: true } }
    ),
  ]);
  const excused = noShows.modifiedCount + lateCancels.modifiedCount + lateArrivals.modifiedCount;
  if (excused > 0) {
    await recordAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: 'customer.no_shows_excused',
      entity: 'Customer',
      entityId: customerId,
      metadata: { businessId, excused, ...(reason ? { reason } : {}) },
    });
  }
  const control = await readNoShowControl(businessId, customerId);
  return { ...control, excused };
}

export async function setBookingOverride(
  businessId: string,
  customerId: string,
  override: BookingOverride,
  reason: string | undefined,
  actor: NoShowActor
): Promise<NoShowControl> {
  const customer = await loadCustomer(businessId, customerId);
  const previous = normalizeBookingOverride(customer.bookingOverride);
  if (previous !== override) {
    customer.bookingOverride = override;
    await customer.save();
    await recordAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: 'customer.booking_override_updated',
      entity: 'Customer',
      entityId: customerId,
      metadata: { businessId, before: previous, after: override, ...(reason ? { reason } : {}) },
    });
  }
  return readNoShowControl(businessId, customerId);
}

/**
 * Marks no-shows at or before each customer's `noShowResetAt` as excused, then clears the field.
 * Appointment status, dates, and prices are left as stored.
 */
export async function migrateNoShowResets(): Promise<{ appointmentsExcused: number; customersCleared: number }> {
  const customers = await Customer.collection
    .find({ noShowResetAt: { $type: 'date' } })
    .project({ _id: 1, businessId: 1, noShowResetAt: 1 })
    .toArray();
  let appointmentsExcused = 0;
  const excusedAt = new Date();
  for (const customer of customers) {
    const resetAt = customer.noShowResetAt as Date;
    const result = await Appointment.updateMany(
      {
        businessId: customer.businessId,
        customerId: customer._id,
        status: 'no_show',
        start: { $lte: resetAt },
        noShowExcused: { $ne: true },
      },
      {
        $set: {
          noShowExcused: true,
          excusedAt,
          excusedReason: 'migrated from noShowResetAt',
        },
      }
    );
    appointmentsExcused += result.modifiedCount;
  }
  const cleared = await Customer.collection.updateMany(
    { noShowResetAt: { $exists: true } },
    { $unset: { noShowResetAt: '' } }
  );
  return { appointmentsExcused, customersCleared: cleared.modifiedCount };
}
