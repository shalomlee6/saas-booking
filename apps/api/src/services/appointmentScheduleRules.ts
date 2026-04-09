import { Types } from 'mongoose';
import { AvailabilityOverride } from '../models/AvailabilityOverride';
import { defaultOpeningHours, type IOpeningHours } from '../models/BusinessSettings';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { applyOpeningHoursWithOverrides } from '../utils/applyOpeningHoursWithOverrides';
import { AppointmentError } from './appointmentErrors';

function parseHhMmToMinutes(s: string): number {
  const [h, m] = s.split(':').map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

/** YYYY-MM-DD for this instant in the given IANA timezone. */
export function formatYyyyMmDdInTimeZone(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Hour:minute in zone, as minutes since local midnight (same calendar day as `d` in that zone). */
function wallClockMinutesInZone(d: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === 'hour') hour = parseInt(p.value, 10);
    if (p.type === 'minute') minute = parseInt(p.value, 10);
  }
  if (hour === 24) hour = 0;
  return hour * 60 + minute;
}

/**
 * Ensures [start, end) falls within effective working ranges for that calendar day
 * (opening hours + availability overrides). Uses only server-side settings — never trusts client flags.
 *
 * @throws AppointmentError 400/403 when closed or outside ranges
 */
export async function assertAppointmentWithinSchedule(
  businessId: Types.ObjectId,
  start: Date,
  end: Date
): Promise<void> {
  if (!(start instanceof Date) || !(end instanceof Date) || start >= end) {
    throw new AppointmentError(400, 'start must be before end');
  }

  const settings = await ensureBusinessSettings(businessId);
  const timezone = settings.localization?.timezone ?? 'Asia/Jerusalem';
  const openingHours: IOpeningHours = settings.openingHours?.days?.length
    ? settings.openingHours
    : defaultOpeningHours;

  const ymdStart = formatYyyyMmDdInTimeZone(start, timezone);
  const ymdEnd = formatYyyyMmDdInTimeZone(end, timezone);
  if (ymdStart !== ymdEnd) {
    throw new AppointmentError(
      400,
      'Appointment must start and end on the same calendar day in the business timezone'
    );
  }

  const overrideDoc = await AvailabilityOverride.findOne({
    businessId,
    date: ymdStart,
  })
    .select('type ranges')
    .lean();

  const override =
    overrideDoc && typeof overrideDoc.type === 'string'
      ? { type: overrideDoc.type as 'closed' | 'custom', ranges: overrideDoc.ranges }
      : null;

  const ranges = applyOpeningHoursWithOverrides(ymdStart, openingHours, override);
  if (!ranges.length) {
    throw new AppointmentError(403, 'Business is closed at this time', 'CLOSED_DAY');
  }

  const startMin = wallClockMinutesInZone(start, timezone);
  const endMin = wallClockMinutesInZone(end, timezone);
  if (endMin <= startMin) {
    throw new AppointmentError(400, 'Invalid time range in business timezone');
  }

  const fits = ranges.some((r) => {
    const rs = parseHhMmToMinutes(r.start);
    const re = parseHhMmToMinutes(r.end);
    if (Number.isNaN(rs) || Number.isNaN(re)) return false;
    return startMin >= rs && endMin <= re;
  });

  if (!fits) {
    throw new AppointmentError(403, 'Appointment is outside working hours', 'OUTSIDE_HOURS');
  }
}
