import { Types } from 'mongoose';
import { DateTime } from 'luxon';
import { Appointment } from '../models/Appointment';
import { AvailabilityOverride } from '../models/AvailabilityOverride';
import { defaultOpeningHours } from '../models/BusinessSettings';
import { Service } from '../models/Service';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { applyOpeningHoursWithOverrides } from '../utils/applyOpeningHoursWithOverrides';
import { buildSlotsFromMergedRanges } from './publicBookingTime';
import { ForbiddenError, NotFoundError } from '../errors/httpErrors';

/**
 * Shared availability logic: openingHours + overrides + existing appointments.
 * Overlap rule: slotStart < apptEnd AND slotEnd > apptStart (exclusive end).
 */
export async function getAvailabilityForBusiness(
  businessId: Types.ObjectId,
  serviceId: string,
  dateStr: string
): Promise<{ date: string; slots: string[] }> {
  const settings = await ensureBusinessSettings(businessId);
  if (!settings.features?.bookingEnabled) {
    throw new ForbiddenError('Booking is disabled for this business');
  }

  const service = await Service.findOne({ _id: serviceId, businessId });
  if (!service) {
    throw new NotFoundError('Service not found');
  }

  const timezone = settings.localization?.timezone ?? 'Asia/Jerusalem';
  const openingHours = settings.openingHours?.days?.length
    ? settings.openingHours!
    : defaultOpeningHours;

  const dayStart = DateTime.fromISO(dateStr, { zone: timezone }).startOf('day');
  const dayEnd = dayStart.plus({ days: 1 });
  const dayStartUtcDate = dayStart.toUTC().toJSDate();
  const dayEndUtcDate = dayEnd.toUTC().toJSDate();

  const existing = await Appointment.find({
    businessId,
    status: { $in: ['confirmed', 'pending'] },
    start: { $lt: dayEndUtcDate },
    end: { $gt: dayStartUtcDate },
  })
    .select('start end status')
    .lean();

  const durationMinutes = service.durationMinutes ?? 30;
  const slotStep = openingHours.slotStepMinutes ?? 30;

  const overrideDoc = await AvailabilityOverride.findOne({ businessId, date: dateStr })
    .select('type ranges')
    .lean();
  const mergedRanges = applyOpeningHoursWithOverrides(
    dateStr,
    openingHours,
    overrideDoc
      ? {
          type: overrideDoc.type as 'closed' | 'custom',
          ranges: overrideDoc.ranges ?? [],
        }
      : null
  );
  const candidateSlots = buildSlotsFromMergedRanges(mergedRanges, durationMinutes, slotStep);

  const available: string[] = [];
  for (const timeStr of candidateSlots) {
    const [hourStr, minuteStr] = timeStr.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    const slotStartLocal = dayStart.set({
      hour,
      minute,
      second: 0,
      millisecond: 0,
    });

    const slotStartMs = slotStartLocal.toUTC().toMillis();
    const slotEndMs = slotStartLocal.plus({ minutes: durationMinutes }).toUTC().toMillis();

    let overlaps = false;

    for (const apt of existing as { start: Date; end: Date }[]) {
      const apptStartMs = DateTime.fromJSDate(apt.start).toUTC().toMillis();
      const apptEndMs = DateTime.fromJSDate(apt.end).toUTC().toMillis();
      if (slotStartMs < apptEndMs && slotEndMs > apptStartMs) {
        overlaps = true;
        break;
      }
    }

    if (!overlaps) available.push(timeStr);
  }

  return { date: dateStr, slots: available };
}
