import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/requireSuperAdmin';
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
  getAdminSettings,
  patchAdminSettings,
  getAdminAnalytics,
  getAdminAudit,
} from '../controllers/adminPlatformController';
import { validateBody } from '../middleware/validateRequest';
import {
  createAdminBusinessBodySchema,
  patchAdminUserBodySchema,
  patchPlatformSettingsBodySchema,
} from '../validation/schemas/admin';

export const adminRouter = Router();

// All admin routes require super admin
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

adminRouter.get('/settings', getAdminSettings);
adminRouter.patch('/settings', validateBody(patchPlatformSettingsBodySchema), patchAdminSettings);

adminRouter.get('/analytics', getAdminAnalytics);
adminRouter.get('/audit', getAdminAudit);





