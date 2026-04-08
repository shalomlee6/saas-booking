import { Router } from 'express';
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
import { requestOtp, verifyOtp } from '../controllers/publicAuthController';
import { optionalPublicCustomer } from '../middleware/optionalPublicCustomer';
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

// --- Public booking API (used by customer UI at /b/:slug/book)
publicRouter.get(
  '/availability',
  validateQuery(publicAvailabilityQuerySchema),
  getPublicAvailability
);
publicRouter.get(
  '/businesses/:slug',
  validateParams(slugParamsSchema),
  getPublicBusinessBySlug
);
publicRouter.get(
  '/businesses/:slug/services',
  validateParams(slugParamsSchema),
  getPublicServicesBooking
);
publicRouter.get(
  '/businesses/:slug/availability',
  validateParams(slugParamsSchema),
  validateQuery(slugAvailabilityQuerySchema),
  getAvailability
);
publicRouter.post(
  '/appointments',
  validateBody(publicCreateAppointmentBodySchema),
  optionalPublicCustomer,
  createPublicAppointmentBooking
);
publicRouter.get('/appointments/upcoming', optionalPublicCustomer, getUpcomingCustomerAppointment);
publicRouter.delete(
  '/appointments/:appointmentId',
  validateParams(publicCancelAppointmentParamsSchema),
  validateBody(publicCancelAppointmentBodySchema),
  optionalPublicCustomer,
  cancelCustomerAppointment
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
publicRouter.post('/:businessSlug/auth/request-otp', requestOtp);
publicRouter.post('/:businessSlug/auth/verify-otp', verifyOtp);
