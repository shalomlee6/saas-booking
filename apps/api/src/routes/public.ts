import { Router } from 'express';
import { getPublicBusiness, getPublicServices, getPublicAvailableSlots, createPublicAppointment } from '../controllers/publicController';
import { requestOtp, verifyOtp } from '../controllers/publicAuthController';

export const publicRouter = Router();

// Public business info
publicRouter.get('/:businessSlug/business', getPublicBusiness);

// Public services
publicRouter.get('/:businessSlug/services', getPublicServices);

// Public available slots
publicRouter.get('/:businessSlug/available-slots', getPublicAvailableSlots);

// Public appointment creation (requires client auth token)
publicRouter.post('/:businessSlug/appointments', createPublicAppointment);

// OTP auth endpoints (dev stub)
publicRouter.post('/:businessSlug/auth/request-otp', requestOtp);
publicRouter.post('/:businessSlug/auth/verify-otp', verifyOtp);

