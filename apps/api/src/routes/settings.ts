import { Router } from 'express';
import { auth } from '../middleware/auth';
import { loadBusinessSettings } from '../middleware/businessSettings';
import { getMyBusinessSettings, updateMyBusinessSettings } from '../controllers/businessSettingsController';

export const settingsRouter = Router();

settingsRouter.get('/me/settings', auth, loadBusinessSettings, getMyBusinessSettings);
settingsRouter.put('/me/settings', auth, loadBusinessSettings, updateMyBusinessSettings);

