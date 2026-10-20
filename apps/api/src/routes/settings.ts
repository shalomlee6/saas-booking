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
  putOwnerPublicTheme,
  putOwnerReliability,
  updateMyBusinessSettings,
} from '../controllers/businessSettingsController';
import {
  bookingRulesBodySchema,
  reliabilityBodySchema,
  settingsResetBodySchema,
} from '../validation/schemas/bookingSettings';
import {
  getSettingsResetStatus,
  postSettingsReset,
  postSettingsRestore,
} from '../controllers/settingsResetController';
import { runLandingImageUpload, postLandingImageUpload } from '../controllers/landingUploadController';
import { publicThemeBodySchema, updateBusinessSettingsBodySchema } from '../validation/schemas/businessSettings';
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

settingsRouter.put(
  '/me/public-theme',
  auth,
  requireBackofficeRole,
  requireBusinessContext,
  requireOwner,
  validateBody(publicThemeBodySchema),
  asyncHandler(putOwnerPublicTheme)
);

// Factory reset (settings only) and "restore previous settings". Owner only.
settingsRouter.post(
  '/me/reset',
  auth,
  requireBackofficeRole,
  requireBusinessContext,
  requireOwner,
  validateBody(settingsResetBodySchema),
  asyncHandler(postSettingsReset)
);
settingsRouter.get(
  '/me/reset/status',
  auth,
  requireBackofficeRole,
  requireBusinessContext,
  requireOwner,
  asyncHandler(getSettingsResetStatus)
);
settingsRouter.post(
  '/me/reset/restore',
  auth,
  requireBackofficeRole,
  requireBusinessContext,
  requireOwner,
  asyncHandler(postSettingsRestore)
);

settingsRouter.post(
  '/me/landing/upload',
  auth,
  requireBackofficeRole,
  requireBusinessContext,
  runLandingImageUpload,
  asyncHandler(postLandingImageUpload)
);

