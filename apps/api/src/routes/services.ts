import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { Service } from '../models/Service';

export const servicesRouter = Router();

// GET /api/services
servicesRouter.get('/', auth, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId!;
    const services = await Service.find({ businessId, isActive: true }).sort({
      name: 1,
    });
    res.json(services);
  } catch (err) {
    console.error('Error GET /services:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/services
servicesRouter.post('/', auth, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId!;
    const { name, description, durationMinutes, price } = req.body;

    if (!name || !durationMinutes || !price) {
      return res
        .status(400)
        .json({ message: 'name, durationMinutes and price are required' });
    }

    const service = await Service.create({
      businessId,
      name,
      description,
      durationMinutes,
      price,
    });

    res.status(201).json(service);
  } catch (err) {
    console.error('Error POST /services:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/services/:id
servicesRouter.put('/:id', auth, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId!;
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
  } catch (err) {
    console.error('Error PUT /services/:id:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});
