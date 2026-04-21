import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth';
import { Business } from '../models/Business';
import { resolveBusinessIdFromReq } from '../utils/resolveBusinessId';

/**
 * Ensures a tenant scope for authenticated routes: JWT businessId or impersonation,
 * with a DB fallback for owners whose token may omit businessId.
 * Sets `req.effectiveBusinessId` on success.
 */
export async function requireBusinessContext(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (req.user?.role === 'super_admin' && req.user.impersonating !== true) {
      res.status(403).json({
        message: 'Tenant context is required. Super-admins must impersonate a business to use this endpoint.',
      });
      return;
    }

    let businessId = resolveBusinessIdFromReq(req);

    if (!businessId && req.user?.role === 'owner' && req.user?.userId) {
      const business = await Business.findOne({ ownerId: req.user.userId }).select('_id').lean();
      if (business) {
        businessId = business._id.toString();
      }
    }

    if (!businessId) {
      res.status(400).json({ message: 'Business context is required' });
      return;
    }

    req.effectiveBusinessId = businessId;
    next();
  } catch (err) {
    next(err);
  }
}
