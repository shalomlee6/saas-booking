import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { Business } from '../models/Business';
import { normalizeBusinessUi, validateBusinessUiBody } from '../utils/businessUi';

export const businessRouter = Router();

businessRouter.get('/me', auth, async (req: AuthRequest, res) => {
  try {
    const business = await Business.findOne({ ownerId: req.user!.userId });

    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    return res.json(business);
  } catch (err) {
    console.error('Error in /business/me:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/business/ui – owner updates own business UI (use req.user.businessId only)
businessRouter.patch('/ui', auth, async (req: AuthRequest, res) => {
  try {
    if (req.user!.role !== 'owner' || !req.user!.businessId) {
      return res.status(403).json({ message: 'Only business owners can update their business UI' });
    }
    const businessId = req.user!.businessId;
    const result = validateBusinessUiBody(req.body);
    if (!result.valid) {
      return res.status(400).json({ message: result.message });
    }
    if (!result.ui || Object.keys(result.ui).length === 0) {
      return res.status(400).json({ message: 'No valid UI fields to update' });
    }
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }
    const currentUi = business.ui && typeof business.ui === 'object' ? business.ui : {};
    const merged = { ...currentUi, ...result.ui };
    business.ui = merged as any;
    await business.save();
    return res.json({ ui: normalizeBusinessUi(business.ui) });
  } catch (err) {
    console.error('Error PATCH /business/ui:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});
