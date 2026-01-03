import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { Business } from '../models/Business';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';

export async function loadBusinessSettings(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let businessId: string | undefined;

    // Try to get businessId from user
    if (req.user?.businessId) {
      businessId = req.user.businessId;
    } else if (req.user?.role === 'owner' && req.user?.userId) {
      // For owner role, try to find business by ownerId
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

