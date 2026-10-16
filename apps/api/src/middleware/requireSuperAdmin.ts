import { Response, NextFunction } from 'express';
import { validateEnv } from '../config/env';
import { AuthRequest } from './auth';
import { logger } from '../utils/logger';

export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: 'Not authenticated' });
    return;
  }

  if (req.user.role !== 'super_admin') {
    res.status(403).json({ message: 'Super admin access required' });
    return;
  }

  const allowedEmails = validateEnv().superAdminEmails;
  if (!allowedEmails.length) {
    logger.warn('super_admin_emails_not_configured', {});
    res.status(403).json({ message: 'Super admin access not configured' });
    return;
  }
  const userEmail = req.user.email?.toLowerCase();

  if (!userEmail || !allowedEmails.includes(userEmail)) {
    res.status(403).json({ message: 'Super admin access denied' });
    return;
  }

  next();
}





