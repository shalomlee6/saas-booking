import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { requireBusinessContext } from '../middleware/requireBusinessContext';
import { requireBackofficeRole } from '../middleware/requireBackofficeRole';
import { validateBody, validateParams, validateQuery } from '../middleware/validateRequest';
import { asyncHandler } from '../utils/asyncHandler';
import {
  customerServiceConfigCreateBodySchema,
  customerServiceConfigIdParamsSchema,
  customerServiceConfigUpdateBodySchema,
  customerServiceConfigsListQuerySchema,
} from '../validation/schemas/customerServiceConfigs';
import {
  createCustomerServiceConfig,
  deleteCustomerServiceConfig,
  getCustomerServiceConfig,
  listCustomerServiceConfigs,
  updateCustomerServiceConfig,
} from '../controllers/customerServiceConfigController';

export const customerServiceConfigsRouter = Router();

customerServiceConfigsRouter.use(auth);
customerServiceConfigsRouter.use(requireBackofficeRole);
customerServiceConfigsRouter.use(requireBusinessContext);

customerServiceConfigsRouter.get(
  '/',
  validateQuery(customerServiceConfigsListQuerySchema),
  asyncHandler((req: AuthRequest, res) => listCustomerServiceConfigs(req, res))
);

customerServiceConfigsRouter.post(
  '/',
  validateBody(customerServiceConfigCreateBodySchema),
  asyncHandler((req: AuthRequest, res) => createCustomerServiceConfig(req, res))
);

customerServiceConfigsRouter.get(
  '/:id',
  validateParams(customerServiceConfigIdParamsSchema),
  asyncHandler((req: AuthRequest, res) => getCustomerServiceConfig(req, res))
);

customerServiceConfigsRouter.put(
  '/:id',
  validateParams(customerServiceConfigIdParamsSchema),
  validateBody(customerServiceConfigUpdateBodySchema),
  asyncHandler((req: AuthRequest, res) => updateCustomerServiceConfig(req, res))
);

customerServiceConfigsRouter.delete(
  '/:id',
  validateParams(customerServiceConfigIdParamsSchema),
  asyncHandler((req: AuthRequest, res) => deleteCustomerServiceConfig(req, res))
);
