import { Types } from 'mongoose';
import { DateTime } from 'luxon';
import { Appointment } from '../models/Appointment';
import { AvailabilityOverride } from '../models/AvailabilityOverride';
import { defaultOpeningHours, type IOpeningHours } from '../models/BusinessSettings';
import { Service } from '../models/Service';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { applyOpeningHoursWithOverrides } from '../utils/applyOpeningHoursWithOverrides';
import { buildSlotsFromMergedRanges, isFutureSlotStart } from './publicBookingTime';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors/httpErrors';
import {
  isBeforeLead,
  isBeyondMaxAdvance,
  rangesOverlapWithBuffer,
  resolveOnlineBookingRules,
  type OnlineBookingRules,
} from './bookingRules';
import { getServiceOverrideForCustomer } from './customerServiceConfigService';

/**
 * Shared availability logic: openingHours + overrides + existing appointments.
 * Overlap rule: slotStart < apptEnd AND slotEnd > apptStart (exclusive end).
 *
 * `customerId` is optional (unknown for anonymous browsing) — when present, a
 * per-customer/per-service duration override (CustomerServiceConfig) takes precedence
 * over the service's own catalog duration, so slots reflect this specific customer's
 * actual expected visit length.
 */

interface AvailabilityContext {
  rules: OnlineBookingRules;
  timezone: string;
  openingHours: IOpeningHours;
  durationMinutes: number;
  price: number;
  slotStep: number;
  bufferMs: number;
}

type OverrideDoc = { type: 'closed' | 'custom'; ranges: { start: string; end: string }[] } | null;
type BusyRange = { start: Date; end: Date };

/** The business's rules and the service's effective length and price, loaded once. */
async function loadAvailabilityContext(
  businessId: Types.ObjectId,
  serviceId: string,
  customerId: string | undefined,
  /** When set, a day beyond the booking horizon fails before the service is looked up. */
  singleDate?: string,
  now: Date = new Date()
): Promise<AvailabilityContext> {
  const settings = await ensureBusinessSettings(businessId);
  if (!settings.features?.bookingEnabled) {
    throw new ForbiddenError('Booking is disabled for this business');
  }
  const rules = resolveOnlineBookingRules(settings);
  const timezone = settings.localization?.timezone ?? 'Asia/Jerusalem';
  if (!rules.enabled) {
    throw new ForbiddenError('Online booking is closed', 'ONLINE_BOOKING_DISABLED');
  }
  if (singleDate && isBeyondMaxAdvance(singleDate, rules.maxAdvanceDays, timezone, now)) {
    throw new ForbiddenError('That date is too far ahead', 'TOO_FAR');
  }

  const service = await Service.findOne({ _id: serviceId, businessId });
  if (!service) {
    throw new NotFoundError('Service not found');
  }

  const openingHours = settings.openingHours?.days?.length ? settings.openingHours : defaultOpeningHours;
  const override = await getServiceOverrideForCustomer(businessId, customerId, serviceId);
  return {
    rules,
    timezone,
    openingHours,
    durationMinutes: override?.durationOverrideMinutes ?? service.durationMinutes ?? 30,
    price: typeof override?.priceOverride === 'number' ? override.priceOverride : service.price ?? 0,
    slotStep: openingHours.slotStepMinutes ?? 30,
    bufferMs: rules.bufferMinutes * 60 * 1000,
  };
}

/** Appointments that could touch the window [from, to), buffer included. */
async function loadBusyRanges(
  businessId: Types.ObjectId,
  ctx: AvailabilityContext,
  from: Date,
  to: Date,
  excludeAppointmentId?: string
): Promise<BusyRange[]> {
  const rows = await Appointment.find({
    businessId,
    status: { $in: ['confirmed', 'pending'] },
    start: { $lt: new Date(to.getTime() + ctx.bufferMs) },
    end: { $gt: new Date(from.getTime() - ctx.bufferMs) },
  })
    .select('start end status')
    .lean();
  return rows.filter((row) => !excludeAppointmentId || row._id.toString() !== excludeAppointmentId);
}

/** The bookable start times of one calendar day. Pure: everything it needs is passed in. */
function computeDaySlots(
  ctx: AvailabilityContext,
  dateStr: string,
  busy: BusyRange[],
  overrideDoc: OverrideDoc,
  now: Date
): string[] {
  const dayStart = DateTime.fromISO(dateStr, { zone: ctx.timezone }).startOf('day');
  const mergedRanges = applyOpeningHoursWithOverrides(dateStr, ctx.openingHours, overrideDoc);
  const candidateSlots = buildSlotsFromMergedRanges(mergedRanges, ctx.durationMinutes, ctx.slotStep);

  const available: string[] = [];
  for (const timeStr of candidateSlots) {
    const [hourStr, minuteStr] = timeStr.split(':');
    const slotStartLocal = dayStart.set({
      hour: parseInt(hourStr, 10),
      minute: parseInt(minuteStr, 10),
      second: 0,
      millisecond: 0,
    });

    const slotStart = slotStartLocal.toJSDate();
    if (!isFutureSlotStart(slotStart, now)) continue;
    if (isBeforeLead(slotStart, ctx.rules.minLeadMinutes, now)) continue;

    const slotStartMs = slotStart.getTime();
    const slotEndMs = slotStartLocal.plus({ minutes: ctx.durationMinutes }).toUTC().toMillis();

    const overlaps = busy.some((apt) =>
      rangesOverlapWithBuffer(
        slotStartMs,
        slotEndMs,
        DateTime.fromJSDate(apt.start).toUTC().toMillis(),
        DateTime.fromJSDate(apt.end).toUTC().toMillis(),
        ctx.bufferMs
      )
    );
    if (!overlaps) available.push(timeStr);
  }
  return available;
}

function overrideOf(doc: { type?: string; ranges?: { start: string; end: string }[] } | null | undefined): OverrideDoc {
  return doc ? { type: doc.type as 'closed' | 'custom', ranges: doc.ranges ?? [] } : null;
}

export async function getAvailabilityForBusiness(
  businessId: Types.ObjectId,
  serviceId: string,
  dateStr: string,
  customerId?: string,
  excludeAppointmentId?: string,
  now: Date = new Date()
): Promise<{ date: string; slots: string[]; durationMinutes: number; price: number }> {
  const ctx = await loadAvailabilityContext(businessId, serviceId, customerId, dateStr, now);

  const dayStart = DateTime.fromISO(dateStr, { zone: ctx.timezone }).startOf('day');
  const busy = await loadBusyRanges(
    businessId,
    ctx,
    dayStart.toUTC().toJSDate(),
    dayStart.plus({ days: 1 }).toUTC().toJSDate(),
    excludeAppointmentId
  );
  const overrideDoc = await AvailabilityOverride.findOne({ businessId, date: dateStr }).select('type ranges').lean();

  return {
    date: dateStr,
    slots: computeDaySlots(ctx, dateStr, busy, overrideOf(overrideDoc), now),
    durationMinutes: ctx.durationMinutes,
    price: ctx.price,
  };
}

/** The days of one month a client could book, within the booking horizon. */
async function availableDaysOfMonth(
  businessId: Types.ObjectId,
  ctx: AvailabilityContext,
  monthStart: DateTime,
  today: DateTime,
  horizon: DateTime,
  excludeAppointmentId: string | undefined,
  now: Date
): Promise<string[]> {
  const monthLast = monthStart.plus({ months: 1 }).minus({ days: 1 });
  const first = monthStart.toMillis() >= today.toMillis() ? monthStart : today;
  const last = monthLast.toMillis() <= horizon.toMillis() ? monthLast : horizon;
  if (first.toMillis() > last.toMillis()) return [];

  const busy = await loadBusyRanges(
    businessId,
    ctx,
    first.toUTC().toJSDate(),
    last.plus({ days: 1 }).toUTC().toJSDate(),
    excludeAppointmentId
  );
  const firstKey = first.toISODate()!;
  const lastKey = last.toISODate()!;
  const overrides = await AvailabilityOverride.find({ businessId, date: { $gte: firstKey, $lte: lastKey } })
    .select('date type ranges')
    .lean();
  const overrideByDate = new Map(overrides.map((doc) => [doc.date as string, overrideOf(doc)]));

  const days: string[] = [];
  for (let day = first; day.toMillis() <= last.toMillis(); day = day.plus({ days: 1 })) {
    const key = day.toISODate()!;
    if (computeDaySlots(ctx, key, busy, overrideByDate.get(key) ?? null, now).length > 0) days.push(key);
  }
  return days;
}

export interface MonthAvailability {
  month: string;
  /** Days of `month` with at least one bookable slot for this service, ascending. */
  availableDays: string[];
  /** The earliest bookable day on or after the start of `month`, which can lie in a later month. */
  firstAvailable: string | null;
  durationMinutes: number;
}

/**
 * Which days of a month can be booked for a service, in one lightweight call.
 *
 * A day is available only when it has a slot the client could actually book: the business is open, the day
 * is not closed by an override, it is not fully booked, and it is inside the booking horizon (not past,
 * not beyond maxAdvanceDays, not wiped out by the minimum lead time). The slot length is the client's own
 * effective duration, and the buffer between appointments counts, exactly as in the per-day availability.
 */
export async function getMonthAvailabilityForBusiness(
  businessId: Types.ObjectId,
  serviceId: string,
  month: string,
  customerId?: string,
  excludeAppointmentId?: string,
  now: Date = new Date()
): Promise<MonthAvailability> {
  const ctx = await loadAvailabilityContext(businessId, serviceId, customerId, undefined, now);
  const monthStart = DateTime.fromISO(`${month}-01`, { zone: ctx.timezone }).startOf('month');
  if (!monthStart.isValid) throw new ValidationError('Invalid month', undefined, 'INVALID_MONTH');

  const today = DateTime.fromJSDate(now, { zone: ctx.timezone }).startOf('day');
  const horizon = today.plus({ days: ctx.rules.maxAdvanceDays });

  const availableDays = await availableDaysOfMonth(businessId, ctx, monthStart, today, horizon, excludeAppointmentId, now);
  let firstAvailable = availableDays[0] ?? null;
  for (
    let cursor = monthStart.plus({ months: 1 });
    firstAvailable === null && cursor.toMillis() <= horizon.toMillis();
    cursor = cursor.plus({ months: 1 })
  ) {
    const later = await availableDaysOfMonth(businessId, ctx, cursor, today, horizon, excludeAppointmentId, now);
    firstAvailable = later[0] ?? null;
  }
  return { month, availableDays, firstAvailable, durationMinutes: ctx.durationMinutes };
}
