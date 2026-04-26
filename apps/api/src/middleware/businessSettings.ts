import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { Business } from '../models/Business';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { getEffectiveBusinessId } from '../utils/effectiveBusinessId';
import { logger } from '../utils/logger';

export async function loadBusinessSettings(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let businessId = getEffectiveBusinessId(req);

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
    logger.error('load_business_settings_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    // Don't block the request if settings loading fails
    next();
  }
}

