import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import {
  getPublicBusiness,
  getPublicServices,
  getPublicAvailableSlots,
  createPublicAppointment,
} from '../controllers/publicController';
import {
  getPublicBusinessBySlug,
  getPublicServices as getPublicServicesBooking,
  getAvailability,
  getPublicAvailability,
  createPublicAppointment as createPublicAppointmentBooking,
  getUpcomingCustomerAppointment,
  cancelCustomerAppointment,
} from '../controllers/publicBookingController';
import { getPublicAuthMe, requestOtp, verifyOtp } from '../controllers/publicAuthController';
import { optionalPublicCustomer } from '../middleware/optionalPublicCustomer';
import { requirePublicCustomer } from '../middleware/requirePublicCustomer';
import { validateBody, validateParams, validateQuery } from '../middleware/validateRequest';
import {
  legacyAvailableSlotsQuerySchema,
  legacyBusinessSlugParamsSchema,
  legacyPublicCreateAppointmentBodySchema,
  publicAvailabilityQuerySchema,
  publicCancelAppointmentBodySchema,
  publicCancelAppointmentParamsSchema,
  publicCreateAppointmentBodySchema,
  slugAvailabilityQuerySchema,
  slugParamsSchema,
} from '../validation/schemas/publicBooking';

export const publicRouter = Router();

publicRouter.get('/auth/me', requirePublicCustomer, asyncHandler(getPublicAuthMe));

// --- Public booking API (used by customer UI at /b/:slug/book)
publicRouter.get(
  '/availability',
  validateQuery(publicAvailabilityQuerySchema),
  asyncHandler(getPublicAvailability)
);
publicRouter.get(
  '/businesses/:slug',
  validateParams(slugParamsSchema),
  asyncHandler(getPublicBusinessBySlug)
);
publicRouter.get(
  '/businesses/:slug/services',
  validateParams(slugParamsSchema),
  asyncHandler(getPublicServicesBooking)
);
publicRouter.get(
  '/businesses/:slug/availability',
  validateParams(slugParamsSchema),
  validateQuery(slugAvailabilityQuerySchema),
  asyncHandler(getAvailability)
);
publicRouter.post(
  '/appointments',
  validateBody(publicCreateAppointmentBodySchema),
  optionalPublicCustomer,
  asyncHandler(createPublicAppointmentBooking)
);
publicRouter.get(
  '/appointments/upcoming',
  optionalPublicCustomer,
  asyncHandler(getUpcomingCustomerAppointment)
);
publicRouter.delete(
  '/appointments/:appointmentId',
  validateParams(publicCancelAppointmentParamsSchema),
  validateBody(publicCancelAppointmentBodySchema),
  optionalPublicCustomer,
  asyncHandler(cancelCustomerAppointment)
);

// --- Legacy public routes (dashboard / auth)
publicRouter.get('/:businessSlug/business', validateParams(legacyBusinessSlugParamsSchema), getPublicBusiness);
publicRouter.get('/:businessSlug/services', validateParams(legacyBusinessSlugParamsSchema), getPublicServices);
publicRouter.get(
  '/:businessSlug/available-slots',
  validateParams(legacyBusinessSlugParamsSchema),
  validateQuery(legacyAvailableSlotsQuerySchema),
  getPublicAvailableSlots
);
publicRouter.post(
  '/:businessSlug/appointments',
  validateParams(legacyBusinessSlugParamsSchema),
  validateBody(legacyPublicCreateAppointmentBodySchema),
  createPublicAppointment
);

// OTP auth endpoints (dev stub)
publicRouter.post(
  '/:businessSlug/auth/request-otp',
  validateParams(legacyBusinessSlugParamsSchema),
  requestOtp
);
publicRouter.post(
  '/:businessSlug/auth/verify-otp',
  validateParams(legacyBusinessSlugParamsSchema),
  verifyOtp
);
