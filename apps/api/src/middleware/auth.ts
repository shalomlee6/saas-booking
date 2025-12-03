import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export interface AuthUser {
  userId: string;
  role: string;
  businessId?: string;
}

export function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers['authorization'];
  let token: string | undefined;

  if (header && header.startsWith('Bearer ')) {
    token = header.substring(7);
  } else if (req.cookies && req.cookies.sb_token) {
    token = req.cookies.sb_token;
  }

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'dev-secret'
    ) as AuthUser;

    req.user = decoded;
    return next();
  } catch (err) {
    console.error('Invalid token', err);
    return res.status(401).json({ message: 'Invalid token' });
  }
}
