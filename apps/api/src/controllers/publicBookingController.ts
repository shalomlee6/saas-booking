import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { DateTime } from 'luxon';
import { Business } from '../models/Business';
import { BusinessSettings, defaultOpeningHours, IOpeningHours } from '../models/BusinessSettings';
import { Service } from '../models/Service';
import { Appointment } from '../models/Appointment';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';

const CANCELLATION_NOTICE_HE = 'יש להודיע מראש על ביטול התור';

// --- GET /api/public/businesses/:slug
export async function getPublicBusinessBySlug(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const business = await Business.findOne({ slug });
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }
    const settings = await ensureBusinessSettings(business._id);
    if (!settings.features?.bookingEnabled) {
      return res.status(403).json({ message: 'Booking is disabled for this business' });
    }
    const openingHours = settings.openingHours?.days?.length
      ? settings.openingHours
      : defaultOpeningHours;
    const timezone = settings.localization?.timezone ?? 'Asia/Jerusalem';
    const language = settings.localization?.language ?? 'he';
    const currency = settings.localization?.currency ?? 'ILS';

    return res.json({
      id: business._id.toString(),
      name: business.name,
      slug: business.slug,
      localization: { language, timezone, currency },
      theme: settings.theme,
      openingHours,
      cancellationNoticeHe: CANCELLATION_NOTICE_HE,
    });
  } catch (err) {
    console.error('Error GET /public/businesses/:slug:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// --- GET /api/public/businesses/:slug/services
export async function getPublicServices(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const business = await Business.findOne({ slug });
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }
    const services = await Service.find({
      businessId: business._id,
      isActive: true,
    }).select('_id name durationMinutes price');

    return res.json(
      services.map((s) => ({
        id: s._id.toString(),
        nameHe: s.name,
        durationMinutes: s.durationMinutes ?? 30,
        price: s.price != null ? s.price : undefined,
      }))
    );
  } catch (err) {
    console.error('Error GET /public/businesses/:slug/services:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

/** Build list of slot start times "HH:mm" for a given day using openingHours in timezone */
function buildCandidateSlots(
  dateStr: string,
  timezone: string,
  openingHours: IOpeningHours
): string[] {
  const dt = DateTime.fromISO(dateStr, { zone: timezone });
  if (!dt.isValid) return [];
  const dayOfWeek = dt.weekday === 7 ? 0 : dt.weekday;
  const dayConfig = openingHours.days?.find((d) => d.day === dayOfWeek);
  if (!dayConfig || !dayConfig.isOpen || !dayConfig.ranges?.length) return [];

  const step = openingHours.slotStepMinutes ?? 30;
  const out: string[] = [];

  for (const range of dayConfig.ranges) {
    const [startH, startM] = range.start.split(':').map(Number);
    const [endH, endM] = range.end.split(':').map(Number);
    let minutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    while (minutes + step <= endMinutes) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      minutes += step;
    }
  }
  return out;
}

/** Parse dateStr (YYYY-MM-DD) + timeStr (HH:mm or H:mm) in timezone to UTC Date */
function toUtcDate(dateStr: string, timeStr: string, timezone: string): Date {
  const [h, m] = timeStr.split(':').map((s) => parseInt(s, 10));
  const padded = `${String(h).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
  const iso = `${dateStr}T${padded}:00`;
  const dt = DateTime.fromISO(iso, { zone: timezone });
  return dt.toUTC().toJSDate();
}

// --- GET /api/public/businesses/:slug/availability
export async function getAvailability(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const { serviceId, date: dateStr } = req.query;

    if (!serviceId || typeof serviceId !== 'string') {
      return res.status(400).json({ message: 'serviceId is required' });
    }
    if (!dateStr || typeof dateStr !== 'string') {
      return res.status(400).json({ message: 'date is required (YYYY-MM-DD)' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ message: 'date must be YYYY-MM-DD' });
    }

    const business = await Business.findOne({ slug });
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }
    const businessId = business._id;

    const settings = await ensureBusinessSettings(businessId);
    if (!settings.features?.bookingEnabled) {
      return res.status(403).json({ message: 'Booking is disabled for this business' });
    }

    const service = await Service.findOne({ _id: serviceId, businessId });
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const timezone = settings.localization?.timezone ?? 'Asia/Jerusalem';
    const openingHours = settings.openingHours?.days?.length
      ? settings.openingHours!
      : defaultOpeningHours;

    const candidateSlots = buildCandidateSlots(dateStr, timezone, openingHours);
    const durationMinutes = service.durationMinutes ?? 30;

    const dayStart = toUtcDate(dateStr, '00:00', timezone);
    const dayEnd = DateTime.fromISO(`${dateStr}T23:59:59`, { zone: timezone })
      .toUTC()
      .toJSDate();

    const existing = await Appointment.find({
      businessId,
      start: { $lt: dayEnd },
      end: { $gt: dayStart },
      status: { $ne: 'cancelled' },
    });

    const available: string[] = [];
    for (const timeStr of candidateSlots) {
      const startAt = toUtcDate(dateStr, timeStr, timezone);
      const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
      const overlaps = existing.some(
        (apt) => startAt < apt.end && endAt > apt.start
      );
      if (!overlaps) available.push(timeStr);
    }

    return res.json({ date: dateStr, slots: available });
  } catch (err) {
    console.error('Error GET /public/businesses/:slug/availability:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// --- POST /api/public/appointments
export async function createPublicAppointment(req: Request, res: Response) {
  try {
    const body = req.body as {
      slug?: string;
      businessId?: string;
      serviceId: string;
      date: string;
      time: string;
      customerName?: string;
      customerPhone?: string;
    };

    const { serviceId, date: dateStr, time: timeStr } = body;
    if (!serviceId || !dateStr || !timeStr) {
      return res.status(400).json({
        message: 'serviceId, date (YYYY-MM-DD) and time (HH:mm) are required',
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ message: 'date must be YYYY-MM-DD' });
    }
    if (!/^\d{1,2}:\d{2}$/.test(timeStr)) {
      return res.status(400).json({ message: 'time must be HH:mm' });
    }

    let business;
    if (body.slug) {
      business = await Business.findOne({ slug: body.slug });
    } else if (body.businessId) {
      business = await Business.findById(body.businessId);
    } else {
      return res.status(400).json({ message: 'slug or businessId is required' });
    }

    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }
    const businessId = business._id;

    const settings = await ensureBusinessSettings(businessId);
    if (!settings.features?.bookingEnabled) {
      return res.status(403).json({ message: 'Booking is disabled for this business' });
    }

    const service = await Service.findOne({ _id: serviceId, businessId });
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const timezone = settings.localization?.timezone ?? 'Asia/Jerusalem';
    const durationMinutes = service.durationMinutes ?? 30;

    const startAt = toUtcDate(dateStr, timeStr, timezone);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);

    const conflicting = await Appointment.findOne({
      businessId,
      start: { $lt: endAt },
      end: { $gt: startAt },
      status: { $ne: 'cancelled' },
    });

    if (conflicting) {
      return res.status(409).json({ message: 'Slot taken' });
    }

    const appointment = await Appointment.create({
      businessId,
      serviceId: new Types.ObjectId(serviceId),
      customerId: undefined,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      price: service.price,
      durationMinutes: service.durationMinutes ?? 30,
      start: startAt,
      end: endAt,
      status: 'confirmed',
      source: 'client-online',
    });

    return res.status(201).json({
      id: appointment._id.toString(),
      status: 'confirmed',
    });
  } catch (err) {
    console.error('Error POST /public/appointments:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
