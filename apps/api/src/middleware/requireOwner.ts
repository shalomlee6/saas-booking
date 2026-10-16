import type { NextFunction, Response } from 'express';
import type { AuthRequest } from './auth';

/**
 * Owner-only gate for metrics, bulk actions, and export.
 * Staff, admin, and a super-admin who is not impersonating are rejected.
 * An impersonating super-admin is treated as the owner, matching the existing
 * owner write check used for business UI and testimonials.
 *
 * Mounted only on customer bulk status, export, and no-show reset.
 * Attaching it to any other existing route would change that route's access.
 */
/** Owner, or a super-admin who is impersonating that business. */
export function isOwnerAccess(req: AuthRequest): boolean {
  if (!req.user) return false;
  if (req.user.role === 'owner') return true;
  return req.user.role === 'super_admin' && req.user.impersonating === true;
}

export function requireOwner(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: 'Not authenticated' });
    return;
  }

  if (!isOwnerAccess(req)) {
    res.status(403).json({ message: 'Owner access required' });
    return;
  }

  next();
}
