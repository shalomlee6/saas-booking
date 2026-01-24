import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Business } from '../models/Business';
import { resolveBusinessIdFromReq } from '../utils/resolveBusinessId';

export async function getMe(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Resolve business ID (handles impersonation)
    const businessId = resolveBusinessIdFromReq(req);
    
    // For super_admin, businessId might be from impersonation
    // For regular owners, use user.businessId
    const effectiveBusinessId = businessId || user.businessId;
    
    let business: any = null;
    if (effectiveBusinessId) {
      business = await Business.findById(effectiveBusinessId);
      if (!business && !req.user.impersonating) {
        // Only return 404 if not impersonating (super admin might not have a business)
        return res.status(404).json({ message: 'Business not found' });
      }
    }


    return res.json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        businessId: effectiveBusinessId?.toString() || user.businessId?.toString(),
        businessSlug: business?.slug?.toString(),
      },
      business: business ? {
        _id: business._id.toString(),
        name: business.name,
        slug: business.slug,
      } : null,
      role: user.role,
    });
  } catch (err) {
    console.error('Error GET /auth/me:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

