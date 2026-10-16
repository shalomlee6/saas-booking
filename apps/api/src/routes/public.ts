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
  getPublicBusinessLanding,
  getPublicServices as getPublicServicesBooking,
  getAvailability,
  getPublicAvailability,
  createPublicAppointment as createPublicAppointmentBooking,
  getUpcomingCustomerAppointment,
  cancelCustomerAppointment,
  rescheduleCustomerAppointment,
} from '../controllers/publicBookingController';
import {
  getPublicConfig,
  getSessionMe,
  postIdentifyComplete,
  postIdentifyStart,
  postIdentifyVerify,
  postSessionLogout,
} from '../controllers/publicIdentityController';
import { optionalPublicCustomer } from '../middleware/optionalPublicCustomer';
import { otpRouteLimiter, otpVerifyRouteLimiter, otpIpRouteLimiter } from '../middleware/rateLimits';
import { requirePublicCustomer } from '../middleware/requirePublicCustomer';
import { validateBody, validateParams, validateQuery } from '../middleware/validateRequest';
import {
  legacyAvailableSlotsQuerySchema,
  legacyBusinessSlugParamsSchema,
  legacyPublicCreateAppointmentBodySchema,
  publicAvailabilityQuerySchema,
  publicCancelAppointmentBodySchema,
  publicCancelAppointmentParamsSchema,
  publicRescheduleAppointmentBodySchema,
  publicCreateAppointmentBodySchema,
  slugAvailabilityQuerySchema,
  slugParamsSchema,
  identifyStartBodySchema,
  identifyVerifyBodySchema,
  identifyCompleteBodySchema,
} from '../validation/schemas/publicBooking';

export const publicRouter = Router();

publicRouter.get('/session/me', requirePublicCustomer, asyncHandler(getSessionMe));
publicRouter.get('/auth/me', requirePublicCustomer, asyncHandler(getSessionMe));
publicRouter.post('/session/logout', asyncHandler(postSessionLogout));
publicRouter.post('/auth/logout', asyncHandler(postSessionLogout));

// --- Public booking API (used by customer UI at /b/:slug/book)
publicRouter.get(
  '/availability',
  validateQuery(publicAvailabilityQuerySchema),
  optionalPublicCustomer,
  asyncHandler(getPublicAvailability)
);
publicRouter.get(
  '/businesses/:slug/config',
  validateParams(slugParamsSchema),
  asyncHandler(getPublicConfig)
);
publicRouter.post(
  '/businesses/:slug/identify/start',
  otpIpRouteLimiter,
  otpRouteLimiter,
  validateParams(slugParamsSchema),
  validateBody(identifyStartBodySchema),
  asyncHandler(postIdentifyStart)
);
publicRouter.post(
  '/businesses/:slug/identify/verify',
  otpIpRouteLimiter,
  otpVerifyRouteLimiter,
  validateParams(slugParamsSchema),
  validateBody(identifyVerifyBodySchema),
  asyncHandler(postIdentifyVerify)
);
publicRouter.post(
  '/businesses/:slug/identify/complete',
  requirePublicCustomer,
  validateParams(slugParamsSchema),
  validateBody(identifyCompleteBodySchema),
  asyncHandler(postIdentifyComplete)
);
publicRouter.get(
  '/businesses/:slug',
  validateParams(slugParamsSchema),
  asyncHandler(getPublicBusinessBySlug)
);
publicRouter.get(
  '/businesses/:slug/landing',
  validateParams(slugParamsSchema),
  asyncHandler(getPublicBusinessLanding)
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
  optionalPublicCustomer,
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
publicRouter.post(
  '/appointments/:appointmentId/reschedule',
  validateParams(publicCancelAppointmentParamsSchema),
  validateBody(publicRescheduleAppointmentBodySchema),
  optionalPublicCustomer,
  asyncHandler(rescheduleCustomerAppointment)
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

