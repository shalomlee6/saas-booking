import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireBusinessContext } from '../middleware/requireBusinessContext';
import { loadBusinessSettings } from '../middleware/businessSettings';
import { getMyBusinessSettings, updateMyBusinessSettings } from '../controllers/businessSettingsController';

export const settingsRouter = Router();

settingsRouter.get('/me/settings', auth, requireBusinessContext, loadBusinessSettings, getMyBusinessSettings);
settingsRouter.put('/me/settings', auth, requireBusinessContext, loadBusinessSettings, updateMyBusinessSettings);

