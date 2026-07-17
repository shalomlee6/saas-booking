import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { validateEnv } from '../config/env';
import { logger } from '../utils/logger';
import { IBusinessSettings } from '../models/BusinessSettings';
import { User } from '../models/User';

export interface AuthRequest extends Request {
  user?: AuthUser;
  businessSettings?: IBusinessSettings;
  /** Set by `requireBusinessContext` for tenant-scoped routes */
  effectiveBusinessId?: string;
}

export interface AuthUser {
  userId: string;
  role: string;
  email?: string;
  businessId?: string;
  impersonatingBusinessId?: string;
  impersonating?: boolean;
}

export async function auth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;

    // 1) Prefer Authorization: Bearer <jwt> (so impersonation token from frontend is used)
    const header = req.headers['authorization'];
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      const [scheme, value] = header.split(' ');
      if (scheme === 'Bearer' && value) {
        token = value;
      }
    }

    // 2) Fallback to cookie
    if (!token && req.cookies?.sb_token) {
      token = req.cookies.sb_token;
    }

    // 3) Fallback to custom header
    if (!token && typeof req.headers['sb_token'] === 'string') {
      token = req.headers['sb_token'] as string;
    }

    if (!token) {
      res.status(401).json({ message: 'No token provided' });
      return;
    }

    const env = validateEnv();
    const decoded = jwt.verify(token, env.JWT_SECRET) as Record<string, unknown>;
    const userId = String(decoded.userId ?? decoded.sub ?? '');
    if (!userId) {
      res.status(401).json({ message: 'Invalid token' });
      return;
    }

    const dbUser = await User.findById(userId).select('_id role email businessId status').lean();
    if (!dbUser || dbUser.status === 'disabled') {
      res.status(401).json({ message: 'Invalid token' });
      return;
    }

    req.user = {
      userId,
      role: String(dbUser.role ?? ''),
      email: dbUser.email ?? (decoded.email != null ? String(decoded.email) : undefined),
      businessId:
        decoded.businessId != null
          ? String(decoded.businessId)
          : dbUser.businessId != null
            ? String(dbUser.businessId)
            : undefined,
      impersonating: decoded.impersonating === true,
      impersonatingBusinessId:
        decoded.impersonatingBusinessId != null ? String(decoded.impersonatingBusinessId) : undefined,
    };
    next();
    return;
  } catch (err) {
    logger.error('auth_token_invalid', { error: err instanceof Error ? err.message : String(err) });
    res.status(401).json({ message: 'Invalid token' });
    return;
  }
}
