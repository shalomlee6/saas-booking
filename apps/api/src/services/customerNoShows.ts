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

export type BookingOverride = 'auto' | 'allow' | 'block';
export type BlockReason = 'threshold' | 'manual' | 'allowed' | 'clear';

const DEFAULT_POLICY: NoShowPolicy = { enabled: true, threshold: 3 };

const CONTROL_ACTIONS = [
  'appointment.no_show_excused',
  'appointment.no_show_unexcused',
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

/**
 * One rule for every caller.
 * `allow` is never blocked. `block` is always blocked.
 * `auto` is blocked only when the policy is on and the canonical count reaches the threshold.
 */
export function resolveBookingBlock(
  override: BookingOverride,
  policy: NoShowPolicy,
  noShowCount: number
): BookingBlock {
  if (override === 'allow') return { blocked: false, reason: 'allowed' };
  if (override === 'block') return { blocked: true, reason: 'manual' };
  if (policy.enabled && noShowCount >= policy.threshold) {
    return { blocked: true, reason: 'threshold' };
  }
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

/** Aggregation expression. Reads the stored override and the already-computed `$noShowCount`. */
export function bookingBlockedExpression(policy: NoShowPolicy): Record<string, unknown> {
  const override = { $ifNull: ['$bookingOverride', 'auto'] };
  const byThreshold = policy.enabled ? { $gte: ['$noShowCount', policy.threshold] } : false;
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
  blocked: boolean;
  blockReason: BlockReason;
  bookingOverride: BookingOverride;
  policy: NoShowPolicy;
  noShows: NoShowControlAppointment[];
  history: NoShowControlHistoryEntry[];
}

async function loadCustomer(businessId: string, customerId: string) {
  if (!Types.ObjectId.isValid(customerId)) throw new NotFoundError('Customer not found');
  const customer = await Customer.findOne({ _id: customerId, businessId });
  if (!customer) throw new NotFoundError('Customer not found');
  return customer;
}

export async function readNoShowControl(businessId: string, customerId: string): Promise<NoShowControl> {
  const customer = await loadCustomer(businessId, customerId);
  const settings = await ensureBusinessSettings(businessId);
  const policy = resolveNoShowPolicy(settings);
  const override = normalizeBookingOverride(customer.bookingOverride);
  const noShowCount = await countCustomerNoShows(businessId, customerId);
  const block = resolveBookingBlock(override, policy, noShowCount);
  const rows = await Appointment.aggregate<{
    _id: Types.ObjectId;
    start: Date;
    noShowExcused?: boolean;
    excusedAt?: Date;
    excusedReason?: string;
    serviceName?: string;
  }>([
    { $match: { businessId: customer.businessId, customerId: customer._id, status: 'no_show' } },
    { $sort: { start: -1 } },
    { $lookup: { from: 'services', localField: 'serviceId', foreignField: '_id', as: 'service' } },
    {
      $project: {
        start: 1,
        noShowExcused: 1,
        excusedAt: 1,
        excusedReason: 1,
        serviceName: { $ifNull: [{ $arrayElemAt: ['$service.name', 0] }, ''] },
      },
    },
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
    noShowCount,
    blocked: block.blocked,
    blockReason: block.reason,
    bookingOverride: override,
    policy,
    noShows: rows.map((row) => ({
      id: row._id.toString(),
      start: row.start,
      serviceName: row.serviceName ?? '',
      excused: row.noShowExcused === true,
      ...(row.excusedAt ? { excusedAt: row.excusedAt } : {}),
      ...(row.excusedReason ? { excusedReason: row.excusedReason } : {}),
    })),
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

export async function setNoShowExcused(
  businessId: string,
  customerId: string,
  appointmentId: string,
  excused: boolean,
  reason: string | undefined,
  actor: NoShowActor
): Promise<NoShowControl> {
  const customer = await loadCustomer(businessId, customerId);
  if (!Types.ObjectId.isValid(appointmentId)) throw new NotFoundError('Appointment not found');
  const appointment = await Appointment.findOne({
    _id: appointmentId,
    businessId: customer.businessId,
    customerId: customer._id,
  });
  if (!appointment) throw new NotFoundError('Appointment not found');
  if (appointment.status !== 'no_show') {
    throw new ValidationError('Only a no-show appointment can be excused');
  }
  const already = appointment.noShowExcused === true;
  if (already !== excused) {
    if (excused) {
      await Appointment.updateOne(
        { _id: appointment._id },
        {
          $set: {
            noShowExcused: true,
            excusedAt: new Date(),
            ...(reason ? { excusedReason: reason } : {}),
          },
          ...(reason ? {} : { $unset: { excusedReason: '' } }),
        }
      );
    } else {
      await Appointment.updateOne(
        { _id: appointment._id },
        { $set: { noShowExcused: false }, $unset: { excusedAt: '', excusedReason: '' } }
      );
    }
    await recordAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: excused ? 'appointment.no_show_excused' : 'appointment.no_show_unexcused',
      entity: 'Appointment',
      entityId: appointmentId,
      metadata: {
        businessId,
        customerId,
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
  const result = await Appointment.updateMany(
    {
      businessId: customer.businessId,
      customerId: customer._id,
      status: 'no_show',
      noShowExcused: { $ne: true },
    },
    {
      $set: {
        noShowExcused: true,
        excusedAt: new Date(),
        ...(reason ? { excusedReason: reason } : {}),
      },
    }
  );
  const excused = result.modifiedCount;
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
