import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { Customer } from '../models/Customer';

export const customersRouter = Router();

// GET /api/customers
customersRouter.get('/', auth, async (req: AuthRequest, res) => {
  try {

    const businessId  = req.body?.user?.businessId ? req.body.user.businessId : null;
    const search = (req.params.search as string) || '';
    // console.table('req: \n' + JSON.stringify(req.user));
    // console.table('req.body: \n' + JSON.stringify(req.body))
    console.table('req.user: \n' + JSON.stringify(req.user))
    const filter: any = businessId ? { businessId } : null;
    if(businessId) {

      if (search) {
        filter.$or = [
          { name: new RegExp(search, 'i') },
          { phone: new RegExp(search, 'i') },
        ];
      }
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
customersRouter.post('/', auth, async (req: AuthRequest, res) => {
  try {

    const { name, phone, email, notes, businessId } = req?.body?.user;

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
    console.table('customer  \n' + JSON.stringify(customer) + '\n')
    res.status(201).json(customer);
  } catch (err) {
    console.error('Error POST /customers:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/customers/:id
customersRouter.get('/:id', auth, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId!;
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
customersRouter.put('/:id', auth, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId!;
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
