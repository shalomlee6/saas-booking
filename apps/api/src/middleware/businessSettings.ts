import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { Business } from '../models/Business';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { resolveBusinessIdFromReq } from '../utils/resolveBusinessId';

export async function loadBusinessSettings(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let businessId = resolveBusinessIdFromReq(req);

    // Fallback: if no businessId from resolver, try to find by ownerId
    if (!businessId && req.user?.role === 'owner' && req.user?.userId) {
      const business = await Business.findOne({ ownerId: req.user.userId });
      if (business) {
        businessId = business._id.toString();
      }
    }

    if (businessId) {
      const settings = await ensureBusinessSettings(businessId);
      req.businessSettings = settings;
    }

    // Always call next() - don't block if settings not found
    next();
  } catch (err) {
    console.error('Error loading business settings:', err);
    // Don't block the request if settings loading fails
    next();
  }
}

