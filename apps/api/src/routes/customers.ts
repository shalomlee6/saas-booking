import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { requireBusinessContext } from '../middleware/requireBusinessContext';
import { Customer } from '../models/Customer';

export const customersRouter = Router();

customersRouter.use(auth);
customersRouter.use(requireBusinessContext);

// GET /api/customers
customersRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const businessId = req.effectiveBusinessId!;
    const search = (req.query.search as string) || '';

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
});

// POST /api/customers
customersRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const businessId = req.effectiveBusinessId!;
    const { name, phone, email, notes } = req.body;

    if (!name || !phone) {
      return res
        .status(400)
        .json({ message: 'name and phone are required' });
    }

    const customer = await Customer.create({
      businessId,
      name,
      phone,
      email,
      notes,
    });

    res.status(201).json(customer);
  } catch (err) {
    console.error('Error POST /customers:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/customers/:id
customersRouter.get('/:id', async (req: AuthRequest, res) => {
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
});

// PUT /api/customers/:id
customersRouter.put('/:id', async (req: AuthRequest, res) => {
  try {
    const businessId = req.effectiveBusinessId!;
    const { id } = req.params;
    const { name, phone, email, notes } = req.body;

    const customer = await Customer.findOneAndUpdate(
      { _id: id, businessId },
      { name, phone, email, notes },
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
});
