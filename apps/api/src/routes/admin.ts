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
import { validateBody } from '../middleware/validateRequest';
import { createAdminBusinessBodySchema } from '../validation/schemas/admin';

export const adminRouter = Router();

// All admin routes require super admin
adminRouter.use(auth);
adminRouter.use(requireSuperAdmin);

adminRouter.get('/businesses', getAdminBusinesses);
adminRouter.post('/businesses', validateBody(createAdminBusinessBodySchema), createAdminBusiness);
adminRouter.post('/impersonate', adminImpersonate);
adminRouter.post('/stop-impersonate', adminStopImpersonate);
adminRouter.patch('/businesses/:id/ui', adminUpdateBusinessUi);





