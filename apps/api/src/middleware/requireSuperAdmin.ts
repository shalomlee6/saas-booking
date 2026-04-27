import { Response, NextFunction } from 'express';
import { validateEnv } from '../config/env';
import { AuthRequest } from './auth';
import { logger } from '../utils/logger';

export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction): any {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ message: 'Super admin access required' });
  }

  const allowedEmails = validateEnv().superAdminEmails;
  if (!allowedEmails.length) {
    logger.warn('super_admin_emails_not_configured', {});
    return res.status(403).json({ message: 'Super admin access not configured' });
  }
  const userEmail = req.user.email?.toLowerCase();

  if (!userEmail || !allowedEmails.includes(userEmail)) {
    return res.status(403).json({ message: 'Super admin access denied' });
  }

  next();
}





