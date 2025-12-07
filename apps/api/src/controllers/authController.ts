import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Business } from '../models/Business';

export async function getMe(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Verify business exists if businessId is present
    if (user.businessId) {
      const business = await Business.findById(user.businessId);
      if (!business) {
        return res.status(404).json({ message: 'Business not found' });
      }
    }

    return res.json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        businessId: user.businessId?.toString(),
      },
      businessId: user.businessId?.toString() || null,
      role: user.role,
    });
  } catch (err) {
    console.error('Error GET /auth/me:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

