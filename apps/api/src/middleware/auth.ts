import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { validateEnv } from '../config/env';
import { IBusinessSettings } from '../models/BusinessSettings';

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

export function auth(req: AuthRequest, res: Response, next: NextFunction) {
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
      return res.status(401).json({ message: 'No token provided' });
    }

    const env = validateEnv();
    const decoded = jwt.verify(token, env.JWT_SECRET) as Record<string, unknown>;
    req.user = {
      userId: String(decoded.userId ?? decoded.sub ?? ''),
      role: String(decoded.role ?? ''),
      email: decoded.email != null ? String(decoded.email) : undefined,
      businessId: decoded.businessId != null ? String(decoded.businessId) : undefined,
      impersonating: decoded.impersonating === true,
      impersonatingBusinessId:
        decoded.impersonatingBusinessId != null ? String(decoded.impersonatingBusinessId) : undefined,
    };
    return next();
  } catch (err) {
    console.error('Invalid token', err);
    return res.status(401).json({ message: 'Invalid token' });
  }
}
