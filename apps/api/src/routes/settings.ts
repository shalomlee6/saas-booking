import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireBusinessContext } from '../middleware/requireBusinessContext';
import { validateBody } from '../middleware/validateRequest';
import { loadBusinessSettings } from '../middleware/businessSettings';
import { getMyBusinessSettings, updateMyBusinessSettings } from '../controllers/businessSettingsController';
import { updateBusinessSettingsBodySchema } from '../validation/schemas/businessSettings';

export const settingsRouter = Router();

settingsRouter.get('/me/settings', auth, requireBusinessContext, loadBusinessSettings, getMyBusinessSettings);
settingsRouter.put(
  '/me/settings',
  auth,
  requireBusinessContext,
  validateBody(updateBusinessSettingsBodySchema),
  loadBusinessSettings,
  updateMyBusinessSettings
);

