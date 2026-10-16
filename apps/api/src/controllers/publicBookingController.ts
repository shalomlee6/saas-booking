import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { DateTime } from 'luxon';
import { Business } from '../models/Business';
import { BusinessSettings, defaultOpeningHours } from '../models/BusinessSettings';
import { Customer } from '../models/Customer';
import { Service } from '../models/Service';
import { Appointment, type IAppointment } from '../models/Appointment';
import { BusinessReview } from '../models/BusinessReview';
import type { RequestWithPublicCustomer } from '../middleware/optionalPublicCustomer';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { createAppointmentAtomic } from '../services/createAppointmentAtomic';
import { getAvailabilityForBusiness } from '../services/publicAvailabilityService';
import { getServiceOverrideForCustomer } from '../services/customerServiceConfigService';
import { toUtcDate } from '../services/publicBookingTime';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../errors/httpErrors';
import { mergeSectionVisibility, normalizeGalleryItems, orderServicesById } from '../utils/publicLanding';
import { rewriteStoredUploadUrl } from '../utils/publicUploadUrl';
import { setNoStore } from '../utils/httpCache';
import { recordAudit } from '../utils/recordAudit';
import {
  enforcePublicBookingCustomer,
  isInsideCancellationWindow,
  resolveCancellationWindowHours,
} from '../services/publicBookingPolicy';
import {
  assertPublicSlotWindow,
  assertUnderActiveLimit,
  buildClientPolicyText,
  resolveOnlineBookingRules,
  ruleErrorForRequest,
} from '../services/bookingRules';
import { resolveReliabilityPolicy } from '../services/customerNoShows';

const CANCELLATION_NOTICE_HE = 'יש להודיע מראש על ביטול התור';

/** `yyyy-mm-dd` of an instant on the business calendar, not the UTC day. */
function reviewDateInTimezone(createdAt: Date, timezone: string): string {
  const zoned = DateTime.fromJSDate(createdAt, { zone: timezone });
  const month = String(zoned.month).padStart(2, '0');
  const day = String(zoned.day).padStart(2, '0');
  return `${zoned.year}-${month}-${day}`;
}

// --- GET /api/public/businesses/:slug
export async function getPublicBusinessBySlug(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;
  const business = await Business.findOne({ slug });
  if (!business) {
    throw new NotFoundError('Business not found', 'BUSINESS_NOT_FOUND');
  }
  const settings = await ensureBusinessSettings(business._id);
  if (!settings.features?.bookingEnabled) {
    throw new ForbiddenError('Booking is disabled for this business', 'BOOKING_DISABLED');
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

  const businessIdObj = business._id as Types.ObjectId;

  const [customerCount, completedAppointments, reviewDocs] = await Promise.all([
    Customer.countDocuments({ businessId: businessIdObj }),
    Appointment.countDocuments({ businessId: businessIdObj, status: 'completed' }),
    BusinessReview.find({ businessId: businessIdObj }).sort({ createdAt: -1 }).limit(25).lean(),
  ]);

  let rating = settings.publicRating ?? 5;
  if (reviewDocs.length > 0) {
    const sum = reviewDocs.reduce((acc, r) => acc + r.rating, 0);
    rating = Math.round((sum / reviewDocs.length) * 10) / 10;
  }

  const portfolioRaw = settings.portfolioImages ?? [];
  const portfolioImages = portfolioRaw
    .filter((u) => typeof u === 'string' && u.trim().length > 0)
    .map((u) => rewriteStoredUploadUrl(u.trim()))
    .slice(0, 50);

  const products = (settings.landingProducts ?? []).filter(
    (p) => p && typeof p.name === 'string' && p.name.trim().length > 0 && typeof p.price === 'number'
  );

  const tagline =
    typeof settings.landingTagline === 'string' && settings.landingTagline.trim()
      ? settings.landingTagline.trim()
      : 'יופי מקצועי, תוצאות מושלמות';

  const coverImageUrl =
    typeof settings.coverImageUrl === 'string' && settings.coverImageUrl.trim()
      ? rewriteStoredUploadUrl(settings.coverImageUrl.trim())
      : null;

  const phoneFromBusiness =
    typeof business.phone === 'string' ? business.phone.trim() : '';
  const phoneFromSettings =
    typeof settings.businessPhonePublic === 'string'
      ? settings.businessPhonePublic.trim()
      : '';
  const phone = phoneFromBusiness || phoneFromSettings || null;

  const galleryItems = normalizeGalleryItems(portfolioImages, settings.landingGalleryItems);
  const sectionVisibility = mergeSectionVisibility(
    settings.landingSectionVisibility as Record<string, boolean> | undefined
  );
  const contactExtra = {
    whatsapp:
      typeof settings.landingContact?.whatsapp === 'string' ? settings.landingContact.whatsapp.trim() : '',
    email: typeof settings.landingContact?.email === 'string' ? settings.landingContact.email.trim() : '',
    location:
      typeof settings.landingContact?.location === 'string' ? settings.landingContact.location.trim() : '',
  };
  const heroDescription =
    typeof settings.landingHeroDescription === 'string' ? settings.landingHeroDescription.trim() : '';
  const secondaryHeroImageUrl =
    typeof settings.landingSecondaryHeroImageUrl === 'string' && settings.landingSecondaryHeroImageUrl.trim()
      ? rewriteStoredUploadUrl(settings.landingSecondaryHeroImageUrl.trim())
      : null;

  setNoStore(res);

  res.json({
    id: business._id.toString(),
    name: business.name,
    slug: business.slug,
    localization: { language, timezone, currency },
    theme: settings.theme,
    openingHours,
    welcomeMessage: welcome,
    cancellationNoticeHe: CANCELLATION_NOTICE_HE,
    onlineBooking: resolveOnlineBookingRules(settings),
    clientPolicy: {
      he: buildClientPolicyText(
        resolveOnlineBookingRules(settings),
        resolveReliabilityPolicy(settings),
        'he'
      ),
      en: buildClientPolicyText(
        resolveOnlineBookingRules(settings),
        resolveReliabilityPolicy(settings),
        'en'
      ),
    },
    landing: {
      tagline,
      coverImageUrl,
      phone,
      heroDescription,
      secondaryHeroImageUrl,
      galleryItems,
      contact: contactExtra,
      sectionVisibility,
      stats: {
        rating,
        customersCount: customerCount,
        completedAppointmentsCount: completedAppointments,
      },
      portfolioImages,
      products: products.map((p) => ({
        name: p.name.trim(),
        description: typeof p.description === 'string' ? p.description.trim() : '',
        price: p.price,
      })),
      reviews: reviewDocs.map((r) => ({
        customerName: r.customerName,
        text: r.text,
        rating: r.rating,
        date: reviewDateInTimezone(r.createdAt, timezone),
      })),
    },
  });
}

// --- GET /api/public/businesses/:slug/landing — structured bundle for landing builder + public page
export async function getPublicBusinessLanding(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;
  const business = await Business.findOne({ slug });
  if (!business) {
    throw new NotFoundError(
      'Business not found for this slug. Use the public booking slug (e.g. from /b/:slug), not the internal business id.',
      'BUSINESS_NOT_FOUND'
    );
  }
  const settings = await ensureBusinessSettings(business._id);
  if (!settings.features?.bookingEnabled) {
    throw new ForbiddenError('Booking is disabled for this business', 'BOOKING_DISABLED');
  }

  const timezone = settings.localization?.timezone ?? 'Asia/Jerusalem';
  const businessIdObj = business._id as Types.ObjectId;
  const [customerCount, completedAppointments, reviewDocs, servicesRaw] = await Promise.all([
    Customer.countDocuments({ businessId: businessIdObj }),
    Appointment.countDocuments({ businessId: businessIdObj, status: 'completed' }),
    BusinessReview.find({ businessId: businessIdObj }).sort({ createdAt: -1 }).limit(25).lean(),
    Service.find({ businessId: business._id, isActive: true })
      .select('_id name description durationMinutes price')
      .lean(),
  ]);

  let rating = settings.publicRating ?? 5;
  if (reviewDocs.length > 0) {
    const sum = reviewDocs.reduce((acc, r) => acc + r.rating, 0);
    rating = Math.round((sum / reviewDocs.length) * 10) / 10;
  }

  const portfolioRaw = settings.portfolioImages ?? [];
  const portfolioImages = portfolioRaw
    .filter((u) => typeof u === 'string' && u.trim().length > 0)
    .map((u) => rewriteStoredUploadUrl(u.trim()))
    .slice(0, 50);

  const products = (settings.landingProducts ?? []).filter(
    (p) => p && typeof p.name === 'string' && p.name.trim().length > 0 && typeof p.price === 'number'
  );

  const tagline =
    typeof settings.landingTagline === 'string' && settings.landingTagline.trim()
      ? settings.landingTagline.trim()
      : 'יופי מקצועי, תוצאות מושלמות';

  const coverImageUrl =
    typeof settings.coverImageUrl === 'string' && settings.coverImageUrl.trim()
      ? rewriteStoredUploadUrl(settings.coverImageUrl.trim())
      : null;

  const phoneFromBusiness = typeof business.phone === 'string' ? business.phone.trim() : '';
  const phoneFromSettings =
    typeof settings.businessPhonePublic === 'string' ? settings.businessPhonePublic.trim() : '';
  const phone = phoneFromBusiness || phoneFromSettings || null;

  const galleryItems = normalizeGalleryItems(portfolioImages, settings.landingGalleryItems);
  const sectionVisibility = mergeSectionVisibility(
    settings.landingSectionVisibility as Record<string, boolean> | undefined
  );

  const serviceRows = servicesRaw.map((s) => ({
    id: s._id.toString(),
    name: s.name,
    description: typeof s.description === 'string' ? s.description.trim() : '',
    durationMinutes: s.durationMinutes ?? 30,
    price: s.price,
  }));
  const servicesOrdered = orderServicesById(serviceRows, settings.landingServiceOrder);

  const secondaryHero =
    typeof settings.landingSecondaryHeroImageUrl === 'string' && settings.landingSecondaryHeroImageUrl.trim()
      ? rewriteStoredUploadUrl(settings.landingSecondaryHeroImageUrl.trim())
      : null;

  setNoStore(res);

  res.json({
    businessName: business.name,
    slug: business.slug,
    heroSection: {
      businessName: business.name,
      tagline,
      description:
        typeof settings.landingHeroDescription === 'string' ? settings.landingHeroDescription.trim() : '',
      heroImage: coverImageUrl,
      heroImageSecondary: secondaryHero,
    },
    services: servicesOrdered,
    gallery: galleryItems,
    contact: {
      phone: phone ?? '',
      whatsapp:
        typeof settings.landingContact?.whatsapp === 'string' ? settings.landingContact.whatsapp.trim() : '',
      email: typeof settings.landingContact?.email === 'string' ? settings.landingContact.email.trim() : '',
      location:
        typeof settings.landingContact?.location === 'string' ? settings.landingContact.location.trim() : '',
    },
    products: products.map((p) => ({
      name: p.name.trim(),
      description: typeof p.description === 'string' ? p.description.trim() : '',
      price: p.price,
    })),
    reviews: reviewDocs.map((r) => ({
      customerName: r.customerName,
      text: r.text,
      rating: r.rating,
      date: reviewDateInTimezone(r.createdAt, timezone),
    })),
    stats: {
      rating,
      customersCount: customerCount,
      completedAppointmentsCount: completedAppointments,
    },
    sections: sectionVisibility,
    portfolioImageUrls: portfolioImages,
  });
}

// --- GET /api/public/businesses/:slug/services
export async function getPublicServices(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;
  const business = await Business.findOne({ slug });
  if (!business) {
    throw new NotFoundError('Business not found', 'BUSINESS_NOT_FOUND');
  }
  const settings = await ensureBusinessSettings(business._id);
  const services = await Service.find({
    businessId: business._id,
    isActive: true,
  })
    .select('_id name description durationMinutes price')
    .lean();

  const rows = services.map((s) => ({
    id: s._id.toString(),
    nameHe: s.name,
    description: typeof s.description === 'string' ? s.description : undefined,
    durationMinutes: s.durationMinutes ?? 30,
    price: s.price != null ? s.price : undefined,
  }));

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.json(orderServicesById(rows, settings.landingServiceOrder));
}

// Re-export for tests or callers that imported from the controller.
// --- GET /api/public/businesses/:slug/availability?serviceId=...&date=YYYY-MM-DD
export async function getAvailability(req: Request, res: Response): Promise<void> {
  const { slug } = req.params as { slug: string };
  const { serviceId, date: dateStr, excludeAppointmentId } = req.query as {
    serviceId: string;
    date: string;
    excludeAppointmentId?: string;
  };

  const business = await Business.findOne({ slug });
  if (!business) {
    throw new NotFoundError('Business not found', 'BUSINESS_NOT_FOUND');
  }

  const publicCustomer = (req as RequestWithPublicCustomer).publicCustomer;
  const customerId =
    publicCustomer?.customerId && publicCustomer.businessId === business._id.toString()
      ? publicCustomer.customerId
      : undefined;
  const excludeId = await ownedAppointmentId(publicCustomer, business._id.toString(), excludeAppointmentId);
  const result = await getAvailabilityForBusiness(
    business._id,
    serviceId,
    dateStr,
    customerId,
    excludeId
  );
  res.json(result);
}

// --- GET /api/public/availability?businessId=...&serviceId=...&date=YYYY-MM-DD
export async function getPublicAvailability(req: Request, res: Response): Promise<void> {
  const { businessId, serviceId, date: dateStr, excludeAppointmentId } = req.query as {
    businessId: string;
    serviceId: string;
    date: string;
    excludeAppointmentId?: string;
  };

  const business = await Business.findById(businessId);
  if (!business) {
    throw new NotFoundError('Business not found', 'BUSINESS_NOT_FOUND');
  }

  const publicCustomer = (req as RequestWithPublicCustomer).publicCustomer;
  const customerId =
    publicCustomer?.customerId && publicCustomer.businessId === business._id.toString()
      ? publicCustomer.customerId
      : undefined;
  const excludeId = await ownedAppointmentId(publicCustomer, business._id.toString(), excludeAppointmentId);
  const result = await getAvailabilityForBusiness(
    business._id,
    serviceId,
    dateStr,
    customerId,
    excludeId
  );
  res.json(result);
}

// --- POST /api/public/appointments
/**
 * `date` (YYYY-MM-DD) and `time` (HH:mm) are wall-clock in the business timezone
 * (`settings.localization.timezone`, default Asia/Jerusalem), then converted to UTC with Luxon.
 * A slot returned by availability for that date and time is the same instant.
 * Owner create uses ISO strings with an explicit offset and stores that instant as-is.
 */
export async function createPublicAppointment(req: Request, res: Response): Promise<void> {
  const body = req.body as {
    slug?: string;
    businessId?: string;
    serviceId: string;
    date: string;
    time: string;
  };

  const { serviceId, date: dateStr, time: timeStr } = body;

  let business;
  if (body.slug) {
    business = await Business.findOne({ slug: body.slug });
  } else {
    business = await Business.findById(body.businessId!);
  }

  if (!business) {
    throw new NotFoundError('Business not found', 'BUSINESS_NOT_FOUND');
  }
  const businessId = business._id;

  const publicCustomer = (req as RequestWithPublicCustomer).publicCustomer;
  if (!publicCustomer) {
    throw new UnauthorizedError('Authentication required', 'AUTH_REQUIRED');
  }
  if (body.slug && publicCustomer.slug && publicCustomer.slug !== body.slug) {
    throw new ForbiddenError('Business mismatch', 'BUSINESS_MISMATCH');
  }
  if (publicCustomer.businessId !== businessId.toString()) {
    throw new ForbiddenError('Business mismatch', 'BUSINESS_MISMATCH');
  }
  if (!publicCustomer.customerId) {
    throw new ValidationError('Complete your details before booking', undefined, 'PROFILE_INCOMPLETE');
  }
  const customer = await Customer.findOne({
    _id: publicCustomer.customerId,
    businessId,
  });
  if (!customer) {
    throw new NotFoundError('Customer not found', 'CUSTOMER_NOT_FOUND');
  }
  await enforcePublicBookingCustomer(req, customer);
  const customerId = customer._id as Types.ObjectId;
  const resolvedCustomerName = customer.name ?? '';
  const resolvedCustomerPhone = customer.phone ?? undefined;

  const settings = await ensureBusinessSettings(businessId);
  if (!settings.features?.bookingEnabled) {
    throw new ForbiddenError('Booking is disabled for this business', 'BOOKING_DISABLED');
  }
  const bookingRules = resolveOnlineBookingRules(settings);

  const service = await Service.findOne({ _id: serviceId, businessId });
  if (!service) {
    throw new NotFoundError('Service not found', 'SERVICE_NOT_FOUND');
  }

  const timezone = settings.localization?.timezone ?? 'Asia/Jerusalem';
  const override = await getServiceOverrideForCustomer(businessId, customerId, serviceId);
  const durationMinutes = override?.durationOverrideMinutes ?? service.durationMinutes ?? 30;
  const price =
    typeof override?.priceOverride === 'number' ? override.priceOverride : service.price;

  let startAt: Date;
  try {
    startAt = toUtcDate(dateStr, timeStr, timezone);
  } catch {
    throw new ValidationError(
      'Validation failed',
      [
        {
          path: 'date',
          message: 'Invalid date or time for the business timezone',
          code: 'custom',
        },
      ],
      'INVALID_DATE_TIME'
    );
  }
  const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
  const timezoneForRules = settings.localization?.timezone ?? 'Asia/Jerusalem';
  assertPublicSlotWindow(req, bookingRules, dateStr, startAt, timezoneForRules);
  await assertUnderActiveLimit(req, businessId.toString(), customerId.toString(), bookingRules);

  const appointment = await createAppointmentAtomic(
    {
      businessId,
      serviceId: new Types.ObjectId(serviceId),
      start: startAt,
      end: endAt,
      source: 'client-online',
      status: bookingRules.onlineDefaultStatus,
      customerId,
      customerName: resolvedCustomerName,
      customerPhone: resolvedCustomerPhone,
      price,
    },
    { requireCustomerId: false }
  );

  res.status(201).json({
    id: appointment._id.toString(),
    status: appointment.status,
    ...(customerId ? { customerId: customerId.toString() } : {}),
  });
}

type PopulatedUpcomingService = { _id: Types.ObjectId; name: string };

function formatPublicAppointmentClock(start: Date, timezone: string): { date: string; time: string } {
  const dtParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(start);
  const getPart = (type: string) => dtParts.find((p) => p.type === type)?.value ?? '00';
  const rawHour = getPart('hour');
  return {
    date: `${getPart('year')}-${getPart('month')}-${getPart('day')}`,
    time: `${rawHour === '24' ? '00' : rawHour}:${getPart('minute')}`,
  };
}

function toPublicUpcomingAppointment(
  apt: {
    _id: Types.ObjectId;
    start: Date;
    status: string;
    serviceId?: PopulatedUpcomingService | Types.ObjectId | null;
  },
  timezone: string,
  canChange: boolean
) {
  const { date, time } = formatPublicAppointmentClock(apt.start, timezone);
  const service =
    apt.serviceId && typeof apt.serviceId === 'object' && 'name' in apt.serviceId
      ? apt.serviceId
      : null;
  return {
    id: apt._id.toString(),
    date,
    time,
    status: apt.status,
    serviceName: service?.name ?? '',
    serviceId: service?._id?.toString() ?? '',
    canChange,
  };
}

async function ownedAppointmentId(
  publicCustomer: RequestWithPublicCustomer['publicCustomer'],
  businessId: string,
  rawId: string | undefined
): Promise<string | undefined> {
  if (!rawId || !publicCustomer?.verified || !publicCustomer.customerId) return undefined;
  if (publicCustomer.businessId !== businessId) return undefined;
  const apt = await Appointment.findOne({
    _id: rawId,
    customerId: new Types.ObjectId(publicCustomer.customerId),
    businessId: new Types.ObjectId(businessId),
  }).select('_id');
  return apt ? apt._id.toString() : undefined;
}

async function customerAudit(
  publicCustomer: { phone: string; customerId?: string; businessId: string; sessionId: string },
  action: string,
  entityId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await recordAudit({
    actorEmail: publicCustomer.phone,
    action,
    entity: 'Appointment',
    entityId,
    metadata: {
      actor: 'customer',
      customerId: publicCustomer.customerId,
      businessId: publicCustomer.businessId,
      sessionId: publicCustomer.sessionId,
      ...metadata,
    },
  });
}

const EMPTY_UPCOMING = { appointment: null, appointments: [] as ReturnType<typeof toPublicUpcomingAppointment>[] };

// --- GET /api/public/appointments/upcoming
/**
 * Returns the authenticated customer's upcoming pending and confirmed appointments,
 * sorted soonest-first. `appointment` is the nearest item (or null) for the home preview;
 * `appointments` is the full list for the Upcoming Appointments page.
 * Unauthenticated callers receive empty results (never another customer's data).
 */
export async function getUpcomingCustomerAppointment(req: Request, res: Response): Promise<void> {
  const publicCustomer = (req as RequestWithPublicCustomer).publicCustomer;
  if (!publicCustomer) {
    res.json(EMPTY_UPCOMING);
    return;
  }
  if (!publicCustomer.verified || !publicCustomer.customerId) {
    throw new UnauthorizedError('Authentication required', 'AUTH_REQUIRED');
  }

  const now = new Date();
  const apts = await Appointment.find({
    customerId: new Types.ObjectId(publicCustomer.customerId),
    businessId: new Types.ObjectId(publicCustomer.businessId),
    status: { $in: ['pending', 'confirmed'] },
    start: { $gte: now },
  })
    .sort({ start: 1 })
    .populate<{ serviceId: PopulatedUpcomingService }>('serviceId', 'name')
    .lean();

  if (!apts.length) {
    res.json(EMPTY_UPCOMING);
    return;
  }

  const settings = await BusinessSettings.findOne({
    businessId: new Types.ObjectId(publicCustomer.businessId),
  });
  const timezone = settings?.localization?.timezone ?? 'Asia/Jerusalem';
  const windowHours = resolveCancellationWindowHours(settings?.cancellationWindowHours);
  const business = await Business.findById(publicCustomer.businessId).select('phone');
  const fromBusiness = typeof business?.phone === 'string' ? business.phone.trim() : '';
  const fromSettings =
    typeof settings?.businessPhonePublic === 'string' ? settings.businessPhonePublic.trim() : '';
  const businessPhone = fromBusiness || fromSettings || null;
  const appointments = apts.map((apt) =>
    toPublicUpcomingAppointment(
      apt,
      timezone,
      isInsideCancellationWindow(apt.start, windowHours, now)
    )
  );

  res.json({
    appointment: appointments[0] ?? null,
    appointments,
    businessPhone,
  });
}

// --- DELETE /api/public/appointments/:appointmentId
/**
 * Customer-initiated cancellation of their own appointment.
 * Requires the public-customer httpOnly cookie for this business.
 *
 * Rules enforced:
 *  - appointment must belong to the authenticated customer
 *  - appointment must belong to the same business as the JWT
 *  - only pending and confirmed appointments can be cancelled
 *  - a non-empty cancellationReason is required (validated here as defence-in-depth)
 */

const CLIENT_CANCELLABLE_STATUSES = new Set(['pending', 'confirmed']);
export async function cancelCustomerAppointment(req: Request, res: Response): Promise<void> {
  const publicCustomer = (req as RequestWithPublicCustomer).publicCustomer;
  if (!publicCustomer?.verified || !publicCustomer.customerId) {
    throw new UnauthorizedError('Authentication required', 'AUTH_REQUIRED');
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
    throw new NotFoundError('Appointment not found', 'APPOINTMENT_NOT_FOUND');
  }

  if (!CLIENT_CANCELLABLE_STATUSES.has(apt.status)) {
    throw new ConflictError('This appointment cannot be cancelled', 'APPOINTMENT_NOT_CANCELLABLE');
  }

  const settings = await ensureBusinessSettings(publicCustomer.businessId);
  const bookingRules = resolveOnlineBookingRules(settings);
  if (!bookingRules.clientCanCancelOnline) {
    throw ruleErrorForRequest(req, 'ONLINE_CANCEL_DISABLED');
  }
  const windowHours = resolveCancellationWindowHours(settings.cancellationWindowHours);
  if (!isInsideCancellationWindow(apt.start, windowHours)) {
    throw new ConflictError(
      'This appointment can no longer be changed online',
      'OUTSIDE_CANCELLATION_WINDOW'
    );
  }

  apt.status = 'cancelled';
  apt.cancellationReason = trimmedReason;
  await apt.save();

  await customerAudit(publicCustomer, 'appointment.cancelled_by_customer', apt._id.toString(), {});

  res.json({ ok: true, appointmentId: apt._id.toString() });
}

async function moveAppointmentInOneTransaction(input: {
  businessId: Types.ObjectId;
  serviceId: Types.ObjectId;
  start: Date;
  end: Date;
  source: 'client-online';
  customerId: Types.ObjectId;
  customerName: string;
  customerPhone?: string;
  price?: number;
  status?: 'confirmed' | 'pending';
  rescheduledFrom: Types.ObjectId;
  originalId: Types.ObjectId;
}): Promise<IAppointment> {
  const apply = async (session?: mongoose.ClientSession): Promise<IAppointment> => {
    const created = await createAppointmentAtomic(
      {
        businessId: input.businessId,
        serviceId: input.serviceId,
        start: input.start,
        end: input.end,
        source: input.source,
        customerId: input.customerId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        price: input.price,
        status: input.status,
        rescheduledFrom: input.rescheduledFrom,
      },
      { requireCustomerId: true, excludeAppointmentId: input.originalId, session }
    );
    const update = Appointment.updateOne(
      { _id: input.originalId },
      {
        $set: {
          status: 'cancelled',
          cancellationReason: 'rescheduled',
          rescheduledTo: created._id,
        },
      }
    );
    if (session) update.session(session);
    await update;
    return created;
  };

  const session = await mongoose.startSession();
  try {
    try {
      let created: IAppointment | null = null;
      await session.withTransaction(async () => {
        created = await apply(session);
      });
      if (!created) {
        throw new Error('Failed to reschedule appointment');
      }
      return created;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      const codeName =
        typeof error === 'object' && error && 'codeName' in error
          ? String((error as { codeName?: string }).codeName ?? '')
          : '';
      const unsupported =
        codeName === 'IllegalOperation' || message.includes('Transaction numbers are only allowed');
      if (!unsupported || process.env.NODE_ENV === 'production') throw error;
      return apply(undefined);
    }
  } finally {
    await session.endSession();
  }
}

export async function rescheduleCustomerAppointment(req: Request, res: Response): Promise<void> {
  const publicCustomer = (req as RequestWithPublicCustomer).publicCustomer;
  if (!publicCustomer?.verified || !publicCustomer.customerId) {
    throw new UnauthorizedError('Authentication required', 'AUTH_REQUIRED');
  }

  const { appointmentId } = req.params as { appointmentId: string };
  const { date: dateStr, time: timeStr } = req.body as { date: string; time: string };

  const apt = await Appointment.findOne({
    _id: appointmentId,
    customerId: new Types.ObjectId(publicCustomer.customerId),
    businessId: new Types.ObjectId(publicCustomer.businessId),
  });
  if (!apt) throw new NotFoundError('Appointment not found', 'APPOINTMENT_NOT_FOUND');
  if (!CLIENT_CANCELLABLE_STATUSES.has(apt.status)) {
    throw new ConflictError('This appointment cannot be changed', 'APPOINTMENT_NOT_CHANGEABLE');
  }

  const settings = await ensureBusinessSettings(publicCustomer.businessId);
  const windowHours = resolveCancellationWindowHours(settings.cancellationWindowHours);
  if (!isInsideCancellationWindow(apt.start, windowHours)) {
    throw new ConflictError(
      'This appointment can no longer be changed online',
      'OUTSIDE_CANCELLATION_WINDOW'
    );
  }
  if (!settings.features?.bookingEnabled) {
    throw new ForbiddenError('Booking is disabled for this business', 'BOOKING_DISABLED');
  }

  const serviceId = apt.serviceId?.toString();
  if (!serviceId) throw new NotFoundError('Service not found', 'SERVICE_NOT_FOUND');
  const service = await Service.findOne({ _id: serviceId, businessId: apt.businessId });
  if (!service) throw new NotFoundError('Service not found', 'SERVICE_NOT_FOUND');

  const customer = await Customer.findOne({
    _id: publicCustomer.customerId,
    businessId: apt.businessId,
  });
  if (!customer) throw new NotFoundError('Customer not found', 'CUSTOMER_NOT_FOUND');
  await enforcePublicBookingCustomer(req, customer);

  const timezone = settings.localization?.timezone ?? 'Asia/Jerusalem';
  const override = await getServiceOverrideForCustomer(apt.businessId, customer._id, serviceId);
  const durationMinutes = override?.durationOverrideMinutes ?? service.durationMinutes ?? 30;
  const price = typeof override?.priceOverride === 'number' ? override.priceOverride : service.price;

  let startAt: Date;
  try {
    startAt = toUtcDate(dateStr, timeStr, timezone);
  } catch {
    throw new ValidationError(
      'Validation failed',
      [{ path: 'date', message: 'Invalid date or time for the business timezone', code: 'custom' }],
      'INVALID_DATE_TIME'
    );
  }
  const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
  const bookingRules = resolveOnlineBookingRules(settings);
  assertPublicSlotWindow(req, bookingRules, dateStr, startAt, timezone);
  await assertUnderActiveLimit(
    req,
    apt.businessId.toString(),
    customer._id.toString(),
    bookingRules,
    apt._id.toString()
  );

  const created = await moveAppointmentInOneTransaction({
    businessId: apt.businessId,
    serviceId: new Types.ObjectId(serviceId),
    start: startAt,
    end: endAt,
    source: 'client-online',
    customerId: customer._id as Types.ObjectId,
    customerName: customer.name ?? '',
    customerPhone: customer.phone ?? undefined,
    price,
    status: apt.status === 'pending' ? 'pending' : 'confirmed',
    rescheduledFrom: apt._id,
    originalId: apt._id,
  });

  await customerAudit(publicCustomer, 'appointment.rescheduled_by_customer', apt._id.toString(), {
    rescheduledTo: created._id.toString(),
    date: dateStr,
    time: timeStr,
  });
  await customerAudit(publicCustomer, 'appointment.rescheduled_by_customer', created._id.toString(), {
    rescheduledFrom: apt._id.toString(),
    date: dateStr,
    time: timeStr,
  });

  const clock = formatPublicAppointmentClock(created.start, timezone);
  res.status(201).json({
    id: created._id.toString(),
    status: created.status,
    customerId: customer._id.toString(),
    date: clock.date,
    time: clock.time,
    serviceId,
    serviceName: service.name,
  });
}
