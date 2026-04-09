import { Types } from 'mongoose';
import { DateTime } from 'luxon';
import { Appointment } from '../models/Appointment';
import { AvailabilityOverride } from '../models/AvailabilityOverride';
import { Customer } from '../models/Customer';
import { defaultOpeningHours } from '../models/BusinessSettings';
import { Service } from '../models/Service';
import { toIsoUtcString } from '../dto/datetime';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { applyOpeningHoursWithOverrides } from '../utils/applyOpeningHoursWithOverrides';

/** Convert a YYYY-MM-DD + HH:mm pair in the given timezone to a UTC Date. */
function slotToUtcDate(dateStr: string, timeStr: string, timezone: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  return DateTime.fromISO(dateStr, { zone: timezone })
    .set({ hour: h ?? 0, minute: m ?? 0, second: 0, millisecond: 0 })
    .toUTC()
    .toJSDate();
}

/**
 * Format a JS Date as YYYY-MM-DD in the given timezone.
 * Uses Intl (not Luxon) to stay within the project's minimal luxon.d.ts contract.
 */
function utcToDateStr(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export type OwnerAvailableSlotsResult =
  | { ok: true; slots: { start: string; end: string }[] }
  | { ok: false; notFound: 'customer' | 'service' };

/**
 * Owner dashboard: available slots for a customer+service over a 7-day window (opening hours + overrides, minus existing appointments).
 */
export async function computeOwnerAvailableSlots(
  businessId: string,
  params: { serviceId: string; customerId: string; weekStart?: string }
): Promise<OwnerAvailableSlotsResult> {
  const { serviceId, customerId, weekStart } = params;

  const customer = await Customer.findOne({ _id: customerId, businessId });
  const service = await Service.findOne({ _id: serviceId, businessId });

  if (!customer) {
    return { ok: false, notFound: 'customer' };
  }

  if (!service) {
    return { ok: false, notFound: 'service' };
  }

  let durationMinutes =
    customer.defaultTreatmentDurationMinutes ?? service.durationMinutes ?? 60;

  const settings = await ensureBusinessSettings(new Types.ObjectId(String(businessId)));
  const timezone = settings.localization?.timezone ?? 'Asia/Jerusalem';
  const openingHours = settings.openingHours?.days?.length
    ? settings.openingHours
    : defaultOpeningHours;
  const slotStep: number = openingHours.slotStepMinutes ?? 30;

  let weekStartStr: string;
  if (weekStart) {
    const parsedDate = new Date(weekStart);
    weekStartStr = utcToDateStr(parsedDate, timezone);
  } else {
    weekStartStr = utcToDateStr(new Date(), timezone);
  }

  const weekStartDt = DateTime.fromISO(weekStartStr, { zone: timezone });
  const startOfWeek = weekStartDt.toJSDate();
  const endOfWeek = weekStartDt.plus({ days: 7 }).toJSDate();

  const appointments = await Appointment.find({
    businessId,
    start: { $lt: endOfWeek },
    end: { $gt: startOfWeek },
    status: { $ne: 'cancelled' },
  });

  const isSlotOccupied = (slotStart: Date, slotEnd: Date): boolean =>
    appointments.some((apt) => apt.start < slotEnd && apt.end > slotStart);

  const availableSlots: { start: string; end: string }[] = [];

  const weekDateStrs: string[] = [];
  for (let d = 0; d < 7; d++) {
    weekDateStrs.push(utcToDateStr(weekStartDt.plus({ days: d }).toJSDate(), timezone));
  }
  const overrideDocs = await AvailabilityOverride.find({
    businessId: new Types.ObjectId(String(businessId)),
    date: { $in: weekDateStrs },
  })
    .select('date type ranges')
    .lean();
  const overrideByDate = new Map(
    overrideDocs.map((o) => [o.date, { type: o.type as 'closed' | 'custom', ranges: o.ranges }])
  );

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const dateStr = weekDateStrs[dayOffset];

    const ranges = applyOpeningHoursWithOverrides(
      dateStr,
      openingHours,
      overrideByDate.get(dateStr) ?? null
    );
    if (!ranges.length) continue;

    for (const range of ranges) {
      const [startH, startM] = range.start.split(':').map(Number);
      const [endH, endM] = range.end.split(':').map(Number);
      let minutes = (startH ?? 0) * 60 + (startM ?? 0);
      const endMinutes = (endH ?? 20) * 60 + (endM ?? 0);

      while (minutes + durationMinutes <= endMinutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const slotStart = slotToUtcDate(dateStr, timeStr, timezone);
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

        if (!isSlotOccupied(slotStart, slotEnd)) {
          availableSlots.push({
            start: toIsoUtcString(slotStart),
            end: toIsoUtcString(slotEnd),
          });
        }
        minutes += slotStep;
      }
    }
  }

  return { ok: true, slots: availableSlots };
}
