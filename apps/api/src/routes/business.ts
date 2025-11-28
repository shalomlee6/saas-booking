import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { Business } from '../models/Business';

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
