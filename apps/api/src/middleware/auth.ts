import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { IBusinessSettings } from '../models/BusinessSettings';

export interface AuthRequest extends Request {
  user?: AuthUser;
  businessSettings?: IBusinessSettings;
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
    const header = req.headers['authorization'];

    if (req.cookies && req.cookies.sb_token) {
      token = req.cookies.sb_token;
    }

    if (!token && typeof header === 'string' && header.startsWith('Bearer ')) {
      const [scheme, value] = header.split(' ');
      if (scheme === 'Bearer' && value) {
        token = value;
      }
    }

    if (!token && typeof req.headers['sb_token'] === 'string') {
      token = req.headers['sb_token'] as string;
    }


    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as AuthUser;
    req.user = decoded;
    return next();
  } catch (err) {
    console.error('Invalid token', err);
    return res.status(401).json({ message: 'Invalid token' });
  }
}
