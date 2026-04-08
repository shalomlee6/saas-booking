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
import { Customer } from '../models/Customer';

export const customersRouter = Router();

customersRouter.use(auth);
customersRouter.use(requireBusinessContext);

// GET /api/customers
customersRouter.get(
  '/',
  validateQuery(customersListQuerySchema),
  async (req: AuthRequest, res) => {
    try {
      const businessId = req.effectiveBusinessId!;
      const q = req.query as { search?: string };
      const search = q.search ?? '';

      const filter: Record<string, unknown> = { businessId };
      if (search) {
        filter.$or = [
          { name: new RegExp(search, 'i') },
          { phone: new RegExp(search, 'i') },
        ];
      }

      const customers = await Customer.find(filter)
        .sort({ createdAt: -1 })
        .limit(200);

      res.json(customers);
    } catch (err) {
      console.error('Error GET /customers:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// POST /api/customers
customersRouter.post(
  '/',
  validateBody(customerCreateBodySchema),
  async (req: AuthRequest, res) => {
    try {
      const businessId = req.effectiveBusinessId!;
      const body = req.body as {
        name: string;
        phone: string;
        email?: string;
        notes?: string;
      };

      const customer = await Customer.create({
        businessId,
        name: body.name,
        phone: body.phone,
        email: body.email === '' ? undefined : body.email,
        notes: body.notes,
      });

      res.status(201).json(customer);
    } catch (err) {
      console.error('Error POST /customers:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// GET /api/customers/:id
customersRouter.get(
  '/:id',
  validateParams(customerIdParamsSchema),
  async (req: AuthRequest, res) => {
    try {
      const businessId = req.effectiveBusinessId!;
      const { id } = req.params;

      const customer = await Customer.findOne({ _id: id, businessId });

      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      res.json(customer);
    } catch (err) {
      console.error('Error GET /customers/:id:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// PUT /api/customers/:id
customersRouter.put(
  '/:id',
  validateParams(customerIdParamsSchema),
  validateBody(customerUpdateBodySchema),
  async (req: AuthRequest, res) => {
    try {
      const businessId = req.effectiveBusinessId!;
      const { id } = req.params;
      const body = req.body as {
        name?: string;
        phone?: string;
        email?: string;
        notes?: string;
      };

      const update: Record<string, unknown> = {};
      if (body.name !== undefined) update.name = body.name;
      if (body.phone !== undefined) update.phone = body.phone;
      if (body.email !== undefined) {
        update.email = body.email === '' ? undefined : body.email;
      }
      if (body.notes !== undefined) update.notes = body.notes;

      const customer = await Customer.findOneAndUpdate(
        { _id: id, businessId },
        { $set: update },
        { new: true }
      );

      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      res.json(customer);
    } catch (err) {
      console.error('Error PUT /customers/:id:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);
