import { Router, type NextFunction, type Response } from 'express';
import { Types } from 'mongoose';
import { auth, AuthRequest } from '../middleware/auth';
import { requireBusinessContext } from '../middleware/requireBusinessContext';
import { requireBackofficeRole } from '../middleware/requireBackofficeRole';
import { requireOwner } from '../middleware/requireOwner';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody, validateParams, validateQuery } from '../middleware/validateRequest';
import { Service } from '../models/Service';
import { assertCanCreateService } from '../utils/planPolicy';
import { bulkSetServiceStatus, exportServices, listServices } from '../controllers/servicesController';
import {
  serviceCreateBodySchema,
  serviceIdParamsSchema,
  serviceUpdateBodySchema,
  servicesBulkStatusBodySchema,
  servicesPagedQuerySchema,
} from '../validation/schemas/services';

export const servicesRouter = Router();

servicesRouter.use(auth);
servicesRouter.use(requireBackofficeRole);
servicesRouter.use(requireBusinessContext);

function servicesListQuery(req: AuthRequest, res: Response, next: NextFunction): void {
  const raw = req.query.page;
  const page = Array.isArray(raw) ? raw[0] : raw;
  const paged = page !== undefined && page !== null && String(page) !== '';
  (req as AuthRequest & { serviceListPaged?: boolean }).serviceListPaged = paged;
  if (!paged) {
    next();
    return;
  }
  validateQuery(servicesPagedQuerySchema)(req, res, next);
}

// GET /api/services — array of active services unless `page` is present.
servicesRouter.get(
  '/',
  servicesListQuery,
  asyncHandler((req: AuthRequest, res) => listServices(req, res))
);

servicesRouter.get(
  '/export',
  requireOwner,
  validateQuery(servicesPagedQuerySchema),
  asyncHandler((req: AuthRequest, res) => exportServices(req, res))
);

servicesRouter.post(
  '/bulk-status',
  requireOwner,
  validateBody(servicesBulkStatusBodySchema),
  asyncHandler((req: AuthRequest, res) => bulkSetServiceStatus(req, res))
);

// POST /api/services
servicesRouter.post('/', validateBody(serviceCreateBodySchema), asyncHandler(async (req: AuthRequest, res) => {
  const businessId = req.effectiveBusinessId!;
  const { name, price, description, durationMinutes, colorHex, textColorHex, isActive } = req.body;

  if (!name || durationMinutes == null || price == null) {
    return res
      .status(400)
      .json({ message: 'name, durationMinutes and price are required' });
  }
  const priceNum = Number(price);
  const durationNum = Number(durationMinutes);
  if (Number.isNaN(priceNum) || priceNum < 0 || Number.isNaN(durationNum) || durationNum < 1) {
    return res.status(400).json({ message: 'Invalid duration or price' });
  }

  try {
    await assertCanCreateService(new Types.ObjectId(businessId));
  } catch (planErr: unknown) {
    const status =
      typeof planErr === 'object' && planErr !== null && 'status' in planErr
        ? (planErr as { status: number }).status
        : undefined;
    if (status === 403) {
      return res.status(403).json({
        message: planErr instanceof Error ? planErr.message : 'Plan limit exceeded',
      });
    }
    throw planErr;
  }

  const service = await Service.create({
    businessId,
    name,
    description,
    durationMinutes: durationNum,
    price: priceNum,
    colorHex,
    textColorHex,
    ...(typeof isActive === 'boolean' ? { isActive } : {}),
  });

  res.status(201).json(service);
}));

// GET /api/services/:id — the edit form loads the existing service through this route.
servicesRouter.get(
  '/:id',
  validateParams(serviceIdParamsSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const businessId = req.effectiveBusinessId!;
    const { id } = req.params;
    const service = await Service.findOne({ _id: id, businessId });
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    res.json(service);
  })
);

// PUT /api/services/:id
servicesRouter.put(
  '/:id',
  validateParams(serviceIdParamsSchema),
  validateBody(serviceUpdateBodySchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const businessId = req.effectiveBusinessId!;
    const { id } = req.params;
    const { name, description, durationMinutes, price, isActive } = req.body;

    const service = await Service.findOneAndUpdate(
      { _id: id, businessId },
      { name, description, durationMinutes, price, isActive },
      { new: true }
    );

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    res.json(service);
  })
);
