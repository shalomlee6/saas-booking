import { Request, Response } from 'express';
import { DateTime } from 'luxon';
import { Business } from '../models/Business';
import { Service } from '../models/Service';
import { Customer } from '../models/Customer';
import { Appointment } from '../models/Appointment';
import { createAppointmentAtomic } from '../services/createAppointmentAtomic';
import { AppointmentError } from '../services/appointmentErrors';
import { defaultOpeningHours } from '../models/BusinessSettings';
import jwt from 'jsonwebtoken';
import { validateEnv } from '../config/env';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { toIsoUtcString } from '../dto/datetime';
import { applyOpeningHoursWithOverrides } from '../utils/applyOpeningHoursWithOverrides';
import { logger } from '../utils/logger';

/** Convert YYYY-MM-DD + HH:mm in a timezone to a UTC Date. */
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


// GET /api/public/:businessSlug/business
export async function getPublicBusiness(req: Request, res: Response) {
  try {
    const { businessSlug } = req.params;
    
    const business = await Business.findOne({ slug: businessSlug });
    
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    // Load settings for theme
    const settings = await ensureBusinessSettings(business._id);

    res.json({
      businessId: business._id.toString(),
      name: business.name,
      slug: business.slug,
      settings: {
        theme: settings.theme,
        plan: settings.plan,
      },
    });
  } catch (err) {
    logger.error('get_public_business_failed', { error: err instanceof Error ? err.message : String(err) });
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/public/:businessSlug/services
export async function getPublicServices(req: Request, res: Response) {
  try {
    const { businessSlug } = req.params;
    
    const business = await Business.findOne({ slug: businessSlug });
    
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    const services = await Service.find({
      businessId: business._id,
      isActive: true,
    }).select('_id name durationMinutes price');

    // Map services with default colors
    const defaultColors = ['#FF9DBC', '#6CD6CD', '#A6DFF8', '#F35271'];
    res.json(services.map((s, idx) => ({
      id: s._id.toString(),
      name: s.name,
      durationMin: s.durationMinutes,
      price: s.price,
      colorHex: defaultColors[idx % defaultColors.length],
    })));
  } catch (err) {
    logger.error('get_public_services_failed', { error: err instanceof Error ? err.message : String(err) });
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/public/:businessSlug/available-slots
export async function getPublicAvailableSlots(req: Request, res: Response) {
  try {
    const { businessSlug } = req.params as { businessSlug: string };
    const { serviceId, customerId, weekStart } = req.query as {
      serviceId: string;
      customerId?: string;
      weekStart?: string;
    };

    // Resolve business
    const business = await Business.findOne({ slug: businessSlug });
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }
    const businessId = business._id;

    // Load service (verify it belongs to this business)
    const service = await Service.findOne({ _id: serviceId, businessId });
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Determine effective treatment duration and mode
    let durationMinutes: number;
    let mode: 'estimated' | 'personalized';

    if (customerId) {
      // Validate customer belongs to business
      const customer = await Customer.findOne({ _id: customerId, businessId });
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      // Use customer-specific duration if available
      durationMinutes =
        customer.defaultTreatmentDurationMinutes ??
        service.durationMinutes ??
        60;
      mode = 'personalized';
    } else {
      // Use service default duration
      durationMinutes = service.durationMinutes ?? 60;
      mode = 'estimated';
    }

    // Load business settings for real opening hours and timezone.
    const settings = await ensureBusinessSettings(businessId);
    const timezone = settings.localization?.timezone ?? 'Asia/Jerusalem';
    const openingHours = settings.openingHours?.days?.length
      ? settings.openingHours
      : defaultOpeningHours;
    const slotStep: number = openingHours.slotStepMinutes ?? 30;

    // Compute week start anchored to the business timezone so day boundaries
    // (midnight→midnight) are correct for the business locale.
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

    const availableSlots: { start: string; end: string; isAvailable: boolean }[] = [];

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const dateStr = utcToDateStr(
        weekStartDt.plus({ days: dayOffset }).toJSDate(),
        timezone
      );

      // Real working ranges for this date (respects weekly schedule and closed days).
      const ranges = applyOpeningHoursWithOverrides(dateStr, openingHours, null);
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
              isAvailable: true,
            });
          }
          minutes += slotStep;
        }
      }
    }

    // Return slots with metadata (response shape unchanged).
    return res.json({
      slots: availableSlots,
      durationMinutes,
      mode,
    });
  } catch (err) {
    logger.error('get_public_available_slots_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /api/public/:businessSlug/appointments
export async function createPublicAppointment(req: Request, res: Response) {
  try {
    const { businessSlug } = req.params as { businessSlug: string };
    const { serviceId, customerId, start, end } = req.body as {
      serviceId: string;
      customerId: string;
      start: string;
      end: string;
    };

    // Verify client token
    const header = req.headers['authorization'];
    let token: string | undefined;

    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      token = header.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    let decoded: any;
    try {
      const env = validateEnv();
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    if (decoded.role !== 'client') {
      return res.status(403).json({ message: 'Invalid token role' });
    }

    // Resolve business
    const business = await Business.findOne({ slug: businessSlug });
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }
    const businessId = business._id;

    // Verify businessId matches token
    if (decoded.businessId !== businessId.toString()) {
      return res.status(403).json({ message: 'Business mismatch' });
    }

    // Verify customer belongs to business and matches token
    if (decoded.customerId !== customerId) {
      return res.status(403).json({ message: 'Customer mismatch' });
    }

    const customer = await Customer.findOne({ _id: customerId, businessId });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    try {
      const appointment = await createAppointmentAtomic(
        {
          businessId,
          serviceId,
          customerId,
          start: startDate,
          end: endDate,
          source: 'client-online',
        },
        { requireCustomerId: true }
      );

      return res.status(201).json({
        appointmentId: appointment._id.toString(),
        status: appointment.status,
      });
    } catch (e) {
      if (e instanceof AppointmentError) {
        const body: Record<string, unknown> = { message: e.message };
        if (e.code) body.code = e.code;
        return res.status(e.status).json(body);
      }
      throw e;
    }
  } catch (err) {
    logger.error('create_public_appointment_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return res.status(500).json({ message: 'Internal server error' });
  }
}

