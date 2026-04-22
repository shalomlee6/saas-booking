import { Router } from 'express';
import { Types } from 'mongoose';
import { auth, AuthRequest } from '../middleware/auth';
import { requireBusinessContext } from '../middleware/requireBusinessContext';
import { Service } from '../models/Service';
import { assertCanCreateService } from '../utils/planPolicy';

export const servicesRouter = Router();

servicesRouter.use(auth);
servicesRouter.use(requireBusinessContext);

// GET /api/services
servicesRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const businessId = req.effectiveBusinessId!;
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
servicesRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const businessId = req.effectiveBusinessId!;
    const { name, price, description, durationMinutes, colorHex, textColorHex } = req.body;

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
    });

    res.status(201).json(service);
  } catch (err) {
    console.error('Error POST /services:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/services/:id
servicesRouter.put('/:id', async (req: AuthRequest, res) => {
  try {
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
  } catch (err) {
    console.error('Error PUT /services/:id:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});
