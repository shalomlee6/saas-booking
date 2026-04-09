import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { requireBusinessContext } from '../middleware/requireBusinessContext';
import { validateBody, validateParams, validateQuery } from '../middleware/validateRequest';
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
customersRouter.use(requireBusinessContext);

customersRouter.get(
  '/',
  validateQuery(customersListQuerySchema),
  (req: AuthRequest, res) => listCustomers(req, res)
);

customersRouter.post(
  '/',
  validateBody(customerCreateBodySchema),
  (req: AuthRequest, res) => createCustomer(req, res)
);

customersRouter.get(
  '/:id',
  validateParams(customerIdParamsSchema),
  (req: AuthRequest, res) => getCustomer(req, res)
);

customersRouter.put(
  '/:id',
  validateParams(customerIdParamsSchema),
  validateBody(customerUpdateBodySchema),
  (req: AuthRequest, res) => updateCustomer(req, res)
);
