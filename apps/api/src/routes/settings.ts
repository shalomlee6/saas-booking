import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireBusinessContext } from '../middleware/requireBusinessContext';
import { requireBackofficeRole } from '../middleware/requireBackofficeRole';
import { requireOwner } from '../middleware/requireOwner';
import { validateBody } from '../middleware/validateRequest';
import { loadBusinessSettings } from '../middleware/businessSettings';
import {
  getMyBusinessSettings,
  getOwnerBookingSettings,
  putOwnerBookingRules,
  putOwnerReliability,
  updateMyBusinessSettings,
} from '../controllers/businessSettingsController';
import { bookingRulesBodySchema, reliabilityBodySchema } from '../validation/schemas/bookingSettings';
import { runLandingImageUpload, postLandingImageUpload } from '../controllers/landingUploadController';
import { updateBusinessSettingsBodySchema } from '../validation/schemas/businessSettings';
import { asyncHandler } from '../utils/asyncHandler';

export const settingsRouter = Router();

settingsRouter.get(
  '/me/settings',
  auth,
  requireBackofficeRole,
  requireBusinessContext,
  loadBusinessSettings,
  asyncHandler(getMyBusinessSettings)
);
settingsRouter.put(
  '/me/settings',
  auth,
  requireBackofficeRole,
  requireBusinessContext,
  validateBody(updateBusinessSettingsBodySchema),
  loadBusinessSettings,
  asyncHandler(updateMyBusinessSettings)
);

settingsRouter.get(
  '/me/booking-rules',
  auth,
  requireBackofficeRole,
  requireBusinessContext,
  requireOwner,
  asyncHandler(getOwnerBookingSettings)
);
settingsRouter.put(
  '/me/booking-rules',
  auth,
  requireBackofficeRole,
  requireBusinessContext,
  requireOwner,
  validateBody(bookingRulesBodySchema),
  asyncHandler(putOwnerBookingRules)
);
settingsRouter.put(
  '/me/reliability',
  auth,
  requireBackofficeRole,
  requireBusinessContext,
  requireOwner,
  validateBody(reliabilityBodySchema),
  asyncHandler(putOwnerReliability)
);

settingsRouter.post(
  '/me/landing/upload',
  auth,
  requireBackofficeRole,
  requireBusinessContext,
  runLandingImageUpload,
  asyncHandler(postLandingImageUpload)
);

