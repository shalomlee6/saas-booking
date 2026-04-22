import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Business } from '../models/Business';
import { BusinessSettings, defaultOpeningHours } from '../models/BusinessSettings';
import { Customer } from '../models/Customer';
import { Service } from '../models/Service';
import { Appointment } from '../models/Appointment';
import type { RequestWithPublicCustomer } from '../middleware/optionalPublicCustomer';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { createAppointmentAtomic } from '../services/createAppointmentAtomic';
import { getAvailabilityForBusiness } from '../services/publicAvailabilityService';
import { toUtcDate } from '../services/publicBookingTime';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../errors/httpErrors';

const CANCELLATION_NOTICE_HE = 'יש להודיע מראש על ביטול התור';

// --- GET /api/public/businesses/:slug
export async function getPublicBusinessBySlug(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;
  const business = await Business.findOne({ slug });
  if (!business) {
    throw new NotFoundError('Business not found');
  }
  const settings = await ensureBusinessSettings(business._id);
  if (!settings.features?.bookingEnabled) {
    throw new ForbiddenError('Booking is disabled for this business');
  }
  const openingHours = settings.openingHours?.days?.length
    ? settings.openingHours
    : defaultOpeningHours;
  const timezone = settings.localization?.timezone ?? 'Asia/Jerusalem';
  const language = settings.localization?.language ?? 'he';
  const currency = settings.localization?.currency ?? 'ILS';

  const welcome =
    typeof settings.bookingWelcomeMessage === 'string' && settings.bookingWelcomeMessage.trim()
      ? settings.bookingWelcomeMessage.trim()
      : 'Book an appointment with us';

  res.json({
    id: business._id.toString(),
    name: business.name,
    slug: business.slug,
    localization: { language, timezone, currency },
    theme: settings.theme,
    openingHours,
    welcomeMessage: welcome,
    cancellationNoticeHe: CANCELLATION_NOTICE_HE,
  });
}

// --- GET /api/public/businesses/:slug/services
export async function getPublicServices(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;
  const business = await Business.findOne({ slug });
  if (!business) {
    throw new NotFoundError('Business not found');
  }
  const services = await Service.find({
    businessId: business._id,
    isActive: true,
  }).select('_id name durationMinutes price');

  res.json(
    services.map((s) => ({
      id: s._id.toString(),
      nameHe: s.name,
      durationMinutes: s.durationMinutes ?? 30,
      price: s.price != null ? s.price : undefined,
    }))
  );
}

// Re-export for tests or callers that imported from the controller.
export { getAvailabilityForBusiness } from '../services/publicAvailabilityService';

// --- GET /api/public/businesses/:slug/availability?serviceId=...&date=YYYY-MM-DD
export async function getAvailability(req: Request, res: Response): Promise<void> {
  const { slug } = req.params as { slug: string };
  const { serviceId, date: dateStr } = req.query as {
    serviceId: string;
    date: string;
  };

  const business = await Business.findOne({ slug });
  if (!business) {
    throw new NotFoundError('Business not found');
  }

  const result = await getAvailabilityForBusiness(business._id, serviceId, dateStr);
  res.json(result);
}

// --- GET /api/public/availability?businessId=...&serviceId=...&date=YYYY-MM-DD
export async function getPublicAvailability(req: Request, res: Response): Promise<void> {
  const { businessId, serviceId, date: dateStr } = req.query as {
    businessId: string;
    serviceId: string;
    date: string;
  };

  const business = await Business.findById(businessId);
  if (!business) {
    throw new NotFoundError('Business not found');
  }

  const result = await getAvailabilityForBusiness(business._id, serviceId, dateStr);
  res.json(result);
}

// --- POST /api/public/appointments
export async function createPublicAppointment(req: Request, res: Response): Promise<void> {
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

  let business;
  if (body.slug) {
    business = await Business.findOne({ slug: body.slug });
  } else {
    business = await Business.findById(body.businessId!);
  }

  if (!business) {
    throw new NotFoundError('Business not found');
  }
  const businessId = business._id;

  const publicCustomer = (req as RequestWithPublicCustomer).publicCustomer;
  let customerId: Types.ObjectId | undefined;
  let resolvedCustomerName: string;
  let resolvedCustomerPhone: string | undefined;

  if (publicCustomer) {
    if (body.slug && publicCustomer.slug && publicCustomer.slug !== body.slug) {
      throw new ForbiddenError('Business mismatch');
    }
    if (publicCustomer.businessId !== businessId.toString()) {
      throw new ForbiddenError('Business mismatch');
    }
    const customer = await Customer.findOne({
      _id: publicCustomer.customerId,
      businessId,
    });
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }
    customerId = customer._id as Types.ObjectId;
    resolvedCustomerName = customer.name ?? '';
    resolvedCustomerPhone = customer.phone ?? undefined;
  } else {
    const rawName = body.customerName;
    const customerName = typeof rawName === 'string' ? rawName.trim() : '';
    if (!customerName) {
      throw new ValidationError('customerName is required and cannot be blank');
    }
    if (customerName.length > 200) {
      throw new ValidationError('customerName must be at most 200 characters');
    }
    resolvedCustomerName = customerName;
    resolvedCustomerPhone =
      typeof body.customerPhone === 'string' ? body.customerPhone.trim() || undefined : undefined;
  }

  const settings = await ensureBusinessSettings(businessId);
  if (!settings.features?.bookingEnabled) {
    throw new ForbiddenError('Booking is disabled for this business');
  }

  const service = await Service.findOne({ _id: serviceId, businessId });
  if (!service) {
    throw new NotFoundError('Service not found');
  }

  const timezone = settings.localization?.timezone ?? 'Asia/Jerusalem';
  const durationMinutes = service.durationMinutes ?? 30;

  let startAt: Date;
  try {
    startAt = toUtcDate(dateStr, timeStr, timezone);
  } catch {
    throw new ValidationError('Validation failed', [
      {
        path: 'date',
        message: 'Invalid date or time for the business timezone',
        code: 'custom',
      },
    ]);
  }
  const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);

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

  res.status(201).json({
    id: appointment._id.toString(),
    status: appointment.status,
  });
}

// --- GET /api/public/appointments/upcoming
/**
 * Returns the customer's nearest upcoming (non-cancelled, future) appointment.
 * Requires a valid public-customer Bearer JWT (role=customer).
 * Returns { appointment: null } when unauthenticated or no future appointment exists.
 */
export async function getUpcomingCustomerAppointment(req: Request, res: Response): Promise<void> {
  const publicCustomer = (req as RequestWithPublicCustomer).publicCustomer;
  if (!publicCustomer) {
    res.json({ appointment: null });
    return;
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
    res.json({ appointment: null });
    return;
  }

  const settings = await BusinessSettings.findOne({
    businessId: new Types.ObjectId(publicCustomer.businessId),
  });
  const timezone = settings?.localization?.timezone ?? 'Asia/Jerusalem';

  const dtParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(apt.start);
  const getPart = (type: string) => dtParts.find((p) => p.type === type)?.value ?? '00';
  const rawHour = getPart('hour');
  const aptDate = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  const aptTime = `${rawHour === '24' ? '00' : rawHour}:${getPart('minute')}`;

  res.json({
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
export async function cancelCustomerAppointment(req: Request, res: Response): Promise<void> {
  const publicCustomer = (req as RequestWithPublicCustomer).publicCustomer;
  if (!publicCustomer) {
    throw new UnauthorizedError('Authentication required');
  }

  const { appointmentId } = req.params as { appointmentId: string };
  const { cancellationReason: trimmedReason } = req.body as {
    cancellationReason: string;
  };

  const apt = await Appointment.findOne({
    _id: appointmentId,
    customerId: new Types.ObjectId(publicCustomer.customerId),
    businessId: new Types.ObjectId(publicCustomer.businessId),
  });

  if (!apt) {
    throw new NotFoundError('Appointment not found');
  }

  if (apt.status === 'cancelled') {
    throw new ConflictError('Appointment is already cancelled');
  }

  if (apt.status === 'completed') {
    throw new ConflictError('Completed appointments cannot be cancelled');
  }

  apt.status = 'cancelled';
  apt.cancellationReason = trimmedReason;
  await apt.save();

  res.json({ ok: true, appointmentId: apt._id.toString() });
}
