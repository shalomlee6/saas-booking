import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth';

const BACKOFFICE_ROLES = new Set(['owner', 'staff', 'admin', 'super_admin']);

/**
 * Security guard for tenant backoffice APIs.
 * Public/customer tokens must not access owner/staff routes.
 */
export function requireBackofficeRole(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const role = req.user?.role;
  if (!role || !BACKOFFICE_ROLES.has(role)) {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  next();
}
