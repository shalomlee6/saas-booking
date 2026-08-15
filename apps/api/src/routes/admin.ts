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
  getAdminCheckSlug,
  patchAdminUserPlan,
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
import { validateBody, validateParams } from '../middleware/validateRequest';
import {
  adminUserIdParamsSchema,
  createAdminBusinessBodySchema,
  patchAdminUserBodySchema,
  patchAdminUserPlanBodySchema,
  patchPlatformSettingsBodySchema,
} from '../validation/schemas/admin';
import { adminResetUserPassword } from '../controllers/passwordResetController';

export const adminRouter = Router();

// Admin routes require authentication and super admin
adminRouter.use(auth);
adminRouter.use(requireSuperAdmin);

adminRouter.post('/test-seed', postAdminTestSeed);

adminRouter.get('/businesses', getAdminBusinesses);
adminRouter.post('/businesses', validateBody(createAdminBusinessBodySchema), createAdminBusiness);
adminRouter.post('/impersonate', adminImpersonate);
adminRouter.post('/stop-impersonate', adminStopImpersonate);
adminRouter.patch('/businesses/:id/ui', adminUpdateBusinessUi);

adminRouter.get('/check-slug', getAdminCheckSlug);
adminRouter.get('/users', getAdminUsers);
adminRouter.patch('/users/:id/plan', validateBody(patchAdminUserPlanBodySchema), patchAdminUserPlan);
adminRouter.get('/users/:id', getAdminUserById);
adminRouter.patch('/users/:id', validateBody(patchAdminUserBodySchema), patchAdminUser);
adminRouter.delete('/users/:id', deleteAdminUser);
adminRouter.post(
  '/users/:id/reset-password',
  validateParams(adminUserIdParamsSchema),
  adminResetUserPassword
);

adminRouter.get('/settings', getAdminSettings);
adminRouter.patch('/settings', validateBody(patchPlatformSettingsBodySchema), patchAdminSettings);

adminRouter.get('/analytics', getAdminAnalytics);
adminRouter.get('/overview', getAdminOverview);
adminRouter.get('/alerts/count', getAdminAlertsCount);
adminRouter.get('/alerts', getAdminAlerts);
adminRouter.patch('/alerts/:id/dismiss', dismissAdminAlert);
adminRouter.patch('/alerts/:id/resolve', resolveAdminAlert);
adminRouter.get('/audit', getAdminAudit);





