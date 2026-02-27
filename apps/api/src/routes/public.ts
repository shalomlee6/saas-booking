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
} from '../controllers/publicBookingController';
import { requestOtp, verifyOtp } from '../controllers/publicAuthController';

export const publicRouter = Router();

// --- Public booking API (used by customer UI at /b/:slug/book)
// GET /api/public/availability?businessId=...&serviceId=...&date=YYYY-MM-DD (real availability)
publicRouter.get('/availability', getPublicAvailability);
// GET /api/public/businesses/:slug
publicRouter.get('/businesses/:slug', getPublicBusinessBySlug);
// GET /api/public/businesses/:slug/services
publicRouter.get('/businesses/:slug/services', getPublicServicesBooking);
// GET /api/public/businesses/:slug/availability?serviceId=...&date=YYYY-MM-DD
publicRouter.get('/businesses/:slug/availability', getAvailability);
// POST /api/public/appointments (body: slug or businessId, serviceId, date, time, customerName?, customerPhone?)
publicRouter.post('/appointments', createPublicAppointmentBooking);

// --- Legacy public routes (dashboard / auth)
publicRouter.get('/:businessSlug/business', getPublicBusiness);
publicRouter.get('/:businessSlug/services', getPublicServices);
publicRouter.get('/:businessSlug/available-slots', getPublicAvailableSlots);
publicRouter.post('/:businessSlug/appointments', createPublicAppointment);

// OTP auth endpoints (dev stub)
publicRouter.post('/:businessSlug/auth/request-otp', requestOtp);
publicRouter.post('/:businessSlug/auth/verify-otp', verifyOtp);

