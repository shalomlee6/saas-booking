import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { requireBusinessContext } from '../middleware/requireBusinessContext';
import { requireBackofficeRole } from '../middleware/requireBackofficeRole';
import { validateBody, validateParams, validateQuery } from '../middleware/validateRequest';
import { asyncHandler } from '../utils/asyncHandler';
import {
  customerCreateBodySchema,
  customerIdParamsSchema,
  customerUpdateBodySchema,
  customersListQuerySchema,
} from '../validation/schemas/customers';
import {
  createCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from '../controllers/customersController';

export const customersRouter = Router();

customersRouter.use(auth);
customersRouter.use(requireBackofficeRole);
customersRouter.use(requireBusinessContext);

customersRouter.get(
  '/',
  validateQuery(customersListQuerySchema),
  asyncHandler((req: AuthRequest, res) => listCustomers(req, res))
);

customersRouter.post(
  '/',
  validateBody(customerCreateBodySchema),
  asyncHandler((req: AuthRequest, res) => createCustomer(req, res))
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
