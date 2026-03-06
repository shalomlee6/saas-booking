import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface PublicCustomer {
  customerId: string;
  businessId: string;
  slug?: string;
}

export interface RequestWithPublicCustomer extends Request {
  publicCustomer?: PublicCustomer;
}

/**
 * Optional auth for public booking: if Authorization Bearer token is present and valid
 * with role === 'customer', attach req.publicCustomer. Never 401s; guest requests proceed without it.
 */
export function optionalPublicCustomer(
  req: RequestWithPublicCustomer,
  res: Response,
  next: NextFunction
): void {
  try {
    const header = req.headers['authorization'];
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      return next();
    }
    const token = header.slice(7).trim();
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as Record<string, unknown>;
    if (String(decoded.role) !== 'customer') return next();

    const customerId = decoded.customerId != null ? String(decoded.customerId) : null;
    const businessId = decoded.businessId != null ? String(decoded.businessId) : null;
    if (!customerId || !businessId) return next();

    req.publicCustomer = {
      customerId,
      businessId,
      slug: decoded.slug != null ? String(decoded.slug) : undefined,
    };
    next();
  } catch {
    next();
  }
}
