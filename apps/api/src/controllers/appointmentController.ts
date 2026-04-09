import { Response } from 'express';
import { Types } from 'mongoose';
import { DateTime } from 'luxon';
import { AuthRequest } from '../middleware/auth';
import { Appointment } from '../models/Appointment';
import { AvailabilityOverride } from '../models/AvailabilityOverride';
import { Customer } from '../models/Customer';
import { Service } from '../models/Service';
import { getEffectiveBusinessId } from '../utils/effectiveBusinessId';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { defaultOpeningHours } from '../models/BusinessSettings';
import { applyOpeningHoursWithOverrides } from '../utils/applyOpeningHoursWithOverrides';
import { toIsoUtcString } from '../dto/datetime';

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

/** GET /api/appointments - list for owner dashboard; flattened DTO, sort start ASC */
export async function getAppointmentsList(req: AuthRequest, res: Response) {
  try {
    const businessId = getEffectiveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: 'businessId is required' });
    }
    const q = req.query as { from?: string; to?: string };
    const start = q.from ? new Date(q.from) : new Date();
    const end = q.to
      ? new Date(q.to)
      : new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const appointments = await Appointment.find({
      businessId,
      start: { $gte: start, $lt: end },
    })
      .populate('customerId', 'name phone')
      .populate('serviceId', 'name durationMinutes price')
      .sort({ start: 1 })
      .lean();

    const dtoArray = appointments.map((apt: any) => {
      const customer = apt.customerId;
      const service = apt.serviceId;
      const price = apt.price ?? service?.price ?? undefined;
      const durationMinutes = apt.durationMinutes ?? service?.durationMinutes ?? undefined;
      return {
        appointmentId: apt._id.toString(),
        start: toIsoUtcString(apt.start),
        end: toIsoUtcString(apt.end),
        status: apt.status,
        price,
        durationMinutes,
        serviceName: service?.name ?? '',
        customerName: customer?.name ?? apt.customerName ?? 'לקוחה',
        customerPhone: customer?.phone ?? apt.customerPhone ?? null,
      };
    });

    res.json(dtoArray);
  } catch (err) {
    console.error('Error GET /appointments:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getBusinessAppointmentsForWeek(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const businessId = getEffectiveBusinessId(req);

    if (!businessId) {
      return res.status(400).json({ message: 'businessId is required' });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfRange = new Date(startOfToday);
    endOfRange.setDate(startOfToday.getDate() + 7);

    const appointments = await Appointment.find({
      businessId,
      start: { $gte: startOfToday, $lt: endOfRange },
      status: { $ne: 'cancelled' },
    })
      .populate('customerId', 'name phone')
      .populate('serviceId', 'name colorHex textColorHex durationMinutes')
      .sort({ start: 1 });

    const dtoArray = appointments.map((apt) => {
      // Check if populated (object) vs ObjectId string
      const customerPopulated = apt.customerId && typeof apt.customerId === 'object' && 'name' in apt.customerId
        ? apt.customerId as any
        : null;
      const servicePopulated = apt.serviceId && typeof apt.serviceId === 'object' && 'name' in apt.serviceId
        ? apt.serviceId as any
        : null;

      return {
        _id: apt._id.toString(),
        start: toIsoUtcString(apt.start),
        end: toIsoUtcString(apt.end),
        status: apt.status,
        customer: customerPopulated
          ? {
              _id: customerPopulated._id.toString(),
              name: customerPopulated.name,
              phone: customerPopulated.phone,
            }
          : null,
        service: servicePopulated
          ? {
              _id: servicePopulated._id.toString(),
              name: servicePopulated.name,
              colorHex: servicePopulated.colorHex,
              textColorHex: servicePopulated.textColorHex,
            }
          : null,
      };
    });

    return res.json(dtoArray);
  } catch (err) {
    console.error('Error GET /appointments/business-week:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export const getAvailableSlots = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const businessId = getEffectiveBusinessId(req);

    if (!businessId) {
      return res.status(400).json({ message: 'businessId is required' });
    }

    const { serviceId, customerId, weekStart } = req.query as {
      serviceId: string;
      customerId: string;
      weekStart?: string;
    };

    // Load customer and service
    const customer = await Customer.findOne({ _id: customerId, businessId });
    const service = await Service.findOne({ _id: serviceId, businessId });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Determine effective treatment duration
    let durationMinutes =
      customer.defaultTreatmentDurationMinutes ??
      service.durationMinutes ??
      60;

    // Load business settings to get real opening hours and timezone.
    const settings = await ensureBusinessSettings(new Types.ObjectId(String(businessId)));
    const timezone = settings.localization?.timezone ?? 'Asia/Jerusalem';
    const openingHours = settings.openingHours?.days?.length
      ? settings.openingHours
      : defaultOpeningHours;
    const slotStep: number = openingHours.slotStepMinutes ?? 30;

    // Compute week start anchored to the business timezone so day boundaries
    // (midnight→midnight) are correct for the owner's locale.
    let weekStartStr: string;
    if (weekStart) {
      const parsedDate = new Date(weekStart);
      weekStartStr = utcToDateStr(parsedDate, timezone);
    } else {
      weekStartStr = utcToDateStr(new Date(), timezone);
    }

    // fromISO with zone gives us midnight of that date in the business timezone.
    const weekStartDt = DateTime.fromISO(weekStartStr, { zone: timezone });
    const startOfWeek = weekStartDt.toJSDate();
    const endOfWeek = weekStartDt.plus({ days: 7 }).toJSDate();

    // Load existing non-cancelled appointments for the week.
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
      weekDateStrs.push(
        utcToDateStr(weekStartDt.plus({ days: d }).toJSDate(), timezone)
      );
    }
    const overrideDocs = await AvailabilityOverride.find({
      businessId: new Types.ObjectId(String(businessId)),
      date: { $in: weekDateStrs },
    })
      .select('date type ranges')
      .lean();
    const overrideByDate = new Map(
      overrideDocs.map((o) => [
        o.date,
        { type: o.type as 'closed' | 'custom', ranges: o.ranges },
      ])
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

    return res.json(availableSlots);
  } catch (err) {
    console.error('Error GET /appointments/available-slots:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

