import { Router, type NextFunction, type Response } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { requireBusinessContext } from '../middleware/requireBusinessContext';
import { requireBackofficeRole } from '../middleware/requireBackofficeRole';
import { requireOwner } from '../middleware/requireOwner';
import { validateBody, validateParams, validateQuery } from '../middleware/validateRequest';
import { asyncHandler } from '../utils/asyncHandler';
import {
  customerCreateBodySchema,
  customerIdParamsSchema,
  customerUpdateBodySchema,
  customersBulkStatusBodySchema,
  customersListQuerySchema,
  customersPagedQuerySchema,
  noShowPolicyBodySchema,
  excuseAllNoShowsBodySchema,
  excuseNoShowBodySchema,
  bookingOverrideBodySchema,
  noShowAppointmentParamsSchema,
} from '../validation/schemas/customers';
import { birthdayFieldBodySchema } from '../validation/schemas/publicBooking';
import {
  bulkSetCustomerStatus,
  createCustomer,
  exportCustomers,
  getCustomer,
  getNoShowPolicy,
  updateNoShowPolicy,
  getCustomerAppointmentHistory,
  getCustomerCardStats,
  listCustomers,
  getNoShowControl,
  excuseCustomerNoShows,
  excuseCustomerNoShow,
  updateBookingOverride,
  updateCustomer,
} from '../controllers/customersController';
import { getBirthdayField, updateBirthdayField } from '../controllers/publicIdentityController';

export const customersRouter = Router();

customersRouter.use(auth);
customersRouter.use(requireBackofficeRole);
customersRouter.use(requireBusinessContext);

function customersListQuery(req: AuthRequest, res: Response, next: NextFunction): void {
  const raw = req.query.page;
  const page = Array.isArray(raw) ? raw[0] : raw;
  const paged = page !== undefined && page !== null && String(page) !== '';
  (req as AuthRequest & { customerListPaged?: boolean }).customerListPaged = paged;
  validateQuery(paged ? customersPagedQuerySchema : customersListQuerySchema)(req, res, next);
}

customersRouter.get(
  '/',
  customersListQuery,
  asyncHandler((req: AuthRequest, res) => listCustomers(req, res))
);

customersRouter.get(
  '/export',
  requireOwner,
  validateQuery(customersPagedQuerySchema),
  asyncHandler((req: AuthRequest, res) => exportCustomers(req, res))
);

customersRouter.post(
  '/',
  validateBody(customerCreateBodySchema),
  asyncHandler((req: AuthRequest, res) => createCustomer(req, res))
);

customersRouter.post(
  '/bulk-status',
  requireOwner,
  validateBody(customersBulkStatusBodySchema),
  asyncHandler((req: AuthRequest, res) => bulkSetCustomerStatus(req, res))
);

customersRouter.get(
  '/birthday-field',
  requireOwner,
  asyncHandler((req: AuthRequest, res) => getBirthdayField(req, res))
);

customersRouter.put(
  '/birthday-field',
  requireOwner,
  validateBody(birthdayFieldBodySchema),
  asyncHandler((req: AuthRequest, res) => updateBirthdayField(req, res))
);

customersRouter.get(
  '/no-show-policy',
  requireOwner,
  asyncHandler((req: AuthRequest, res) => getNoShowPolicy(req, res))
);

customersRouter.put(
  '/no-show-policy',
  requireOwner,
  validateBody(noShowPolicyBodySchema),
  asyncHandler((req: AuthRequest, res) => updateNoShowPolicy(req, res))
);

customersRouter.get(
  '/:id',
  validateParams(customerIdParamsSchema),
  asyncHandler((req: AuthRequest, res) => getCustomer(req, res))
);

customersRouter.put(
  '/:id',
  validateParams(customerIdParamsSchema),
  validateBody(customerUpdateBodySchema),
  asyncHandler((req: AuthRequest, res) => updateCustomer(req, res))
);

customersRouter.get(
  '/:id/no-show-control',
  validateParams(customerIdParamsSchema),
  asyncHandler((req: AuthRequest, res) => getNoShowControl(req, res))
);

customersRouter.post(
  '/:id/no-shows/excuse-all',
  requireOwner,
  validateParams(customerIdParamsSchema),
  validateBody(excuseAllNoShowsBodySchema),
  asyncHandler((req: AuthRequest, res) => excuseCustomerNoShows(req, res))
);

customersRouter.post(
  '/:id/no-shows/:appointmentId',
  requireOwner,
  validateParams(noShowAppointmentParamsSchema),
  validateBody(excuseNoShowBodySchema),
  asyncHandler((req: AuthRequest, res) => excuseCustomerNoShow(req, res))
);

customersRouter.patch(
  '/:id/booking-override',
  requireOwner,
  validateParams(customerIdParamsSchema),
  validateBody(bookingOverrideBodySchema),
  asyncHandler((req: AuthRequest, res) => updateBookingOverride(req, res))
);

customersRouter.get(
  '/:id/appointments',
  validateParams(customerIdParamsSchema),
  asyncHandler((req: AuthRequest, res) => getCustomerAppointmentHistory(req, res))
);

customersRouter.get(
  '/:id/stats',
  validateParams(customerIdParamsSchema),
  asyncHandler((req: AuthRequest, res) => getCustomerCardStats(req, res))
);
