import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { logger } from '../utils/logger';

export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction): any {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ message: 'Super admin access required' });
  }

  // Check email against SUPER_ADMIN_EMAILS env var
  const superAdminEmails = process.env.SUPER_ADMIN_EMAILS;
  if (!superAdminEmails) {
    logger.warn('super_admin_emails_not_configured', {});
    return res.status(403).json({ message: 'Super admin access not configured' });
  }

  const allowedEmails = superAdminEmails.split(',').map((e) => e.trim().toLowerCase());
  const userEmail = req.user.email?.toLowerCase();

  if (!userEmail || !allowedEmails.includes(userEmail)) {
    return res.status(403).json({ message: 'Super admin access denied' });
  }

  next();
}





