import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/requireSuperAdmin';
import { postAdminTestSeed } from '../controllers/adminTestSeedController';
import {
  getAdminBusinesses,
  createAdminBusiness,
  adminImpersonate,
  adminStopImpersonate,
  adminUpdateBusinessUi,
} from '../controllers/adminController';
import {
  getAdminUsers,
  getAdminUserById,
  patchAdminUser,
  deleteAdminUser,
  getAdminSettings,
  patchAdminSettings,
  getAdminAnalytics,
  getAdminOverview,
  getAdminAudit,
} from '../controllers/adminPlatformController';
import {
  getAdminAlerts,
  getAdminAlertsCount,
  dismissAdminAlert,
  resolveAdminAlert,
} from '../controllers/adminAlertsController';
import { validateBody } from '../middleware/validateRequest';
import {
  createAdminBusinessBodySchema,
  patchAdminUserBodySchema,
  patchPlatformSettingsBodySchema,
} from '../validation/schemas/admin';

export const adminRouter = Router();

adminRouter.post('/test-seed', postAdminTestSeed);

// All other admin routes require super admin
adminRouter.use(auth);
adminRouter.use(requireSuperAdmin);

adminRouter.get('/businesses', getAdminBusinesses);
adminRouter.post('/businesses', validateBody(createAdminBusinessBodySchema), createAdminBusiness);
adminRouter.post('/impersonate', adminImpersonate);
adminRouter.post('/stop-impersonate', adminStopImpersonate);
adminRouter.patch('/businesses/:id/ui', adminUpdateBusinessUi);

adminRouter.get('/users', getAdminUsers);
adminRouter.get('/users/:id', getAdminUserById);
adminRouter.patch('/users/:id', validateBody(patchAdminUserBodySchema), patchAdminUser);
adminRouter.delete('/users/:id', deleteAdminUser);

adminRouter.get('/settings', getAdminSettings);
adminRouter.patch('/settings', validateBody(patchPlatformSettingsBodySchema), patchAdminSettings);

adminRouter.get('/analytics', getAdminAnalytics);
adminRouter.get('/overview', getAdminOverview);
adminRouter.get('/alerts/count', getAdminAlertsCount);
adminRouter.get('/alerts', getAdminAlerts);
adminRouter.patch('/alerts/:id/dismiss', dismissAdminAlert);
adminRouter.patch('/alerts/:id/resolve', resolveAdminAlert);
adminRouter.get('/audit', getAdminAudit);





