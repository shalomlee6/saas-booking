import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireBusinessContext } from '../middleware/requireBusinessContext';
import { requireBackofficeRole } from '../middleware/requireBackofficeRole';
import { validateBody } from '../middleware/validateRequest';
import { loadBusinessSettings } from '../middleware/businessSettings';
import { getMyBusinessSettings, updateMyBusinessSettings } from '../controllers/businessSettingsController';
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

