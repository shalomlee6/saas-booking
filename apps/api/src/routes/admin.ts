import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/requireSuperAdmin';
import {
  getAdminBusinesses,
  createAdminBusiness,
  adminImpersonate,
  adminStopImpersonate,
} from '../controllers/adminController';

export const adminRouter = Router();

// All admin routes require super admin
adminRouter.use(auth);
adminRouter.use(requireSuperAdmin);

adminRouter.get('/businesses', getAdminBusinesses);
adminRouter.post('/businesses', createAdminBusiness);
adminRouter.post('/impersonate', adminImpersonate);
adminRouter.post('/stop-impersonate', adminStopImpersonate);





