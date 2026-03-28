import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { DateTime } from 'luxon';
import { Business } from '../models/Business';
import { BusinessSettings, defaultOpeningHours, IOpeningHours } from '../models/BusinessSettings';
import { Customer } from '../models/Customer';
import { Service } from '../models/Service';
import { Appointment } from '../models/Appointment';
import type { RequestWithPublicCustomer } from '../middleware/optionalPublicCustomer';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { isOverlapping } from '../utils/timeOverlap';
import { createAppointmentAtomic, AppointmentError } from '../services/createAppointmentAtomic';

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
  const [h, m] = timeStr.split(':').map((s) => Number(s));
  const local = DateTime.fromISO(dateStr, { zone: timezone }).set({
    hour: h,
    minute: m,
    second: 0,
    millisecond: 0,
  });

  if (!local.isValid) {
    throw new Error(`Invalid date/time: ${dateStr} ${timeStr} (${timezone})`);
  }

  return local.toUTC().toJSDate();
}

/** Error used by getAvailabilityForBusiness for 403/404 */
class AvailabilityError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'AvailabilityError';
  }
}

/**
 * Shared availability logic: openingHours + service duration + existing appointments.
 * Uses Luxon for timezone-safe day boundaries (Asia/Jerusalem default).
 * Overlap rule: slotStart < apptEnd AND slotEnd > apptStart (exclusive end).
 */
export async function getAvailabilityForBusiness(
  businessId: Types.ObjectId,
  serviceId: string,
  dateStr: string
): Promise<{ date: string; slots: string[] }> {
  const settings = await ensureBusinessSettings(businessId);
  if (!settings.features?.bookingEnabled) {
    throw new AvailabilityError(403, 'Booking is disabled for this business');
  }

  const service = await Service.findOne({ _id: serviceId, businessId });
  if (!service) {
    throw new AvailabilityError(404, 'Service not found');
  }

  const timezone = settings.localization?.timezone ?? 'Asia/Jerusalem';
  const openingHours = settings.openingHours?.days?.length
    ? settings.openingHours!
    : defaultOpeningHours;

  // Day boundaries in business timezone (luxon): dayStart = date 00:00, dayEnd = (date+1) 00:00 (exclusive)
  const dayStart = DateTime.fromISO(dateStr, { zone: timezone }).startOf('day');
  const dayEnd = dayStart.plus({ days: 1 });
  const dayStartUtcDate = dayStart.toUTC().toJSDate();
  const dayEndUtcDate = dayEnd.toUTC().toJSDate();


  const existing = await Appointment.find({
    businessId,
    // NOTE: we intentionally do NOT filter by serviceId here:
    // any confirmed/pending appointment should block the time slot.
    status: { $in: ['confirmed', 'pending'] },
    start: { $lt: dayEndUtcDate },
    end: { $gt: dayStartUtcDate },
  })
    .select('start end status')
    .lean();


  const candidateSlots = buildCandidateSlots(dateStr, timezone, openingHours);
  const durationMinutes = service.durationMinutes ?? 30;

  const available: string[] = [];
  for (const timeStr of candidateSlots) {
    const [hourStr, minuteStr] = timeStr.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    // Slot start in business timezone on that date
    const slotStartLocal = dayStart.set({
      hour,
      minute,
      second: 0,
      millisecond: 0,
    });

    // Convert slot range to UTC epoch milliseconds
    const slotStartMs = slotStartLocal.toUTC().toMillis();
    const slotEndMs = slotStartLocal
      .plus({ minutes: durationMinutes })
      .toUTC()
      .toMillis();

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

// --- GET /api/public/businesses/:slug/availability?serviceId=...&date=YYYY-MM-DD
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

    const result = await getAvailabilityForBusiness(business._id, serviceId, dateStr);
    return res.json(result);
  } catch (err: any) {
    if (err instanceof AvailabilityError) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('Error GET /public/businesses/:slug/availability:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// --- GET /api/public/availability?businessId=...&serviceId=...&date=YYYY-MM-DD
export async function getPublicAvailability(req: Request, res: Response) {
  try {
    const { businessId, serviceId, date: dateStr } = req.query;

    if (!businessId || typeof businessId !== 'string') {
      return res.status(400).json({ message: 'businessId is required' });
    }
    if (!serviceId || typeof serviceId !== 'string') {
      return res.status(400).json({ message: 'serviceId is required' });
    }
    if (!dateStr || typeof dateStr !== 'string') {
      return res.status(400).json({ message: 'date is required (YYYY-MM-DD)' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ message: 'date must be YYYY-MM-DD' });
    }

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    const result = await getAvailabilityForBusiness(
      business._id,
      serviceId,
      dateStr
    );
    return res.json(result);
  } catch (err: any) {
    if (err instanceof AvailabilityError) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('Error GET /public/availability:', err);
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

    const publicCustomer = (req as RequestWithPublicCustomer).publicCustomer;
    let customerId: Types.ObjectId | undefined;
    let resolvedCustomerName: string;
    let resolvedCustomerPhone: string | undefined;

    if (publicCustomer) {
      if (publicCustomer.businessId !== businessId.toString()) {
        return res.status(403).json({ message: 'Business mismatch' });
      }
      const customer = await Customer.findOne({
        _id: publicCustomer.customerId,
        businessId,
      });
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
      customerId = customer._id as Types.ObjectId;
      resolvedCustomerName = customer.name ?? '';
      resolvedCustomerPhone = customer.phone ?? undefined;
    } else {
      const rawName = body.customerName;
      const customerName = typeof rawName === 'string' ? rawName.trim() : '';
      if (!customerName) {
        return res.status(400).json({
          message: 'customerName is required and cannot be blank',
        });
      }
      if (customerName.length > 200) {
        return res.status(400).json({
          message: 'customerName must be at most 200 characters',
        });
      }
      resolvedCustomerName = customerName;
      resolvedCustomerPhone =
        typeof body.customerPhone === 'string' ? body.customerPhone.trim() || undefined : undefined;
    }

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

    try {
      const appointment = await createAppointmentAtomic(
        {
          businessId,
          serviceId: new Types.ObjectId(serviceId),
          start: startAt,
          end: endAt,
          source: 'client-online',
          customerId,
          customerName: resolvedCustomerName,
          customerPhone: resolvedCustomerPhone,
        },
        { requireCustomerId: false }
      );

      return res.status(201).json({
        id: appointment._id.toString(),
        status: appointment.status,
      });
    } catch (err: any) {
      if (err instanceof AppointmentError) {
        const bodyOut: any = { message: err.message };
        if (err.code) bodyOut.code = err.code;
        return res.status(err.status).json(bodyOut);
      }
      throw err;
    }
  } catch (err) {
    console.error('Error POST /public/appointments:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// --- GET /api/public/appointments/upcoming
/**
 * Returns the customer's nearest upcoming (non-cancelled, future) appointment.
 * Requires a valid public-customer Bearer JWT (role=customer).
 * Returns { appointment: null } when unauthenticated or no future appointment exists.
 */
export async function getUpcomingCustomerAppointment(req: Request, res: Response) {
  try {
    const publicCustomer = (req as RequestWithPublicCustomer).publicCustomer;
    if (!publicCustomer) {
      return res.json({ appointment: null });
    }

    const now = new Date();
    const apt = await Appointment.findOne({
      customerId: new Types.ObjectId(publicCustomer.customerId),
      businessId: new Types.ObjectId(publicCustomer.businessId),
      status: { $nin: ['cancelled'] },
      start: { $gt: now },
    })
      .sort({ start: 1 })
      .populate<{ serviceId: { name: string } }>('serviceId', 'name')
      .lean();

    if (!apt) {
      return res.json({ appointment: null });
    }

    const settings = await BusinessSettings.findOne({
      businessId: new Types.ObjectId(publicCustomer.businessId),
    });
    const timezone = settings?.localization?.timezone ?? 'Asia/Jerusalem';

    // Use Intl.DateTimeFormat to convert the UTC Date to the business timezone.
    // 'en-CA' is chosen deliberately: it reliably yields plain Arabic-numeral parts
    // (year/month/day/hour/minute) without RTL marks or locale-specific separators
    // that some environments inject for non-Latin locales such as 'he-IL'.
    const dtParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(apt.start);
    const getPart = (type: string) =>
      dtParts.find((p) => p.type === type)?.value ?? '00';
    const rawHour = getPart('hour');
    const aptDate = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
    const aptTime = `${rawHour === '24' ? '00' : rawHour}:${getPart('minute')}`;

    return res.json({
      appointment: {
        id: apt._id.toString(),
        date: aptDate,
        time: aptTime,
        status: apt.status,
        serviceName:
          apt.serviceId && typeof apt.serviceId === 'object' && 'name' in apt.serviceId
            ? (apt.serviceId as { name: string }).name
            : '',
      },
    });
  } catch (err) {
    console.error('Error GET /public/appointments/upcoming:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// --- DELETE /api/public/appointments/:appointmentId
/**
 * Customer-initiated cancellation of their own appointment.
 * Requires a valid public-customer Bearer JWT (role=customer).
 *
 * Rules enforced:
 *  - appointment must belong to the authenticated customer
 *  - appointment must belong to the same business as the JWT
 *  - appointment must not already be cancelled
 *  - a non-empty cancellationReason is required (validated here as defence-in-depth)
 */
export async function cancelCustomerAppointment(req: Request, res: Response) {
  try {
    const publicCustomer = (req as RequestWithPublicCustomer).publicCustomer;
    if (!publicCustomer) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { appointmentId } = req.params;
    const { cancellationReason } = req.body as { cancellationReason?: string };

    // Validate reason (defence-in-depth; frontend also enforces this).
    const trimmedReason = (cancellationReason ?? '').trim();
    if (!trimmedReason) {
      return res.status(400).json({ message: 'cancellationReason is required' });
    }

    // Load the appointment, enforcing both customer AND business ownership.
    const apt = await Appointment.findOne({
      _id: appointmentId,
      customerId: new Types.ObjectId(publicCustomer.customerId),
      businessId: new Types.ObjectId(publicCustomer.businessId),
    });

    if (!apt) {
      // Return 404 regardless of whether the id exists — prevents info leakage.
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (apt.status === 'cancelled') {
      return res.status(409).json({ message: 'Appointment is already cancelled' });
    }

    if (apt.status === 'completed') {
      return res.status(409).json({ message: 'Completed appointments cannot be cancelled' });
    }

    apt.status = 'cancelled';
    apt.cancellationReason = trimmedReason;
    await apt.save();

    return res.json({ ok: true, appointmentId: apt._id.toString() });
  } catch (err) {
    console.error('Error DELETE /public/appointments/:appointmentId:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
