import type { Response, NextFunction } from 'express';
import type { RequestWithPublicCustomer } from '../types/publicCustomer';
import {
  getPublicCustomerJwtFromRequest,
  renewPublicCustomerSession,
  verifyPublicCustomerJwt,
} from '../utils/publicCustomerSession';

export type { PublicCustomer, RequestWithPublicCustomer } from '../types/publicCustomer';

/**
 * Optional auth for public booking: Bearer token or HTTP-only session cookie from verify-otp.
 * If present and valid with role === 'customer', attaches req.publicCustomer. Never 401s.
 */
export function optionalPublicCustomer(
  req: RequestWithPublicCustomer,
  res: Response,
  next: NextFunction
): void {
  const token = getPublicCustomerJwtFromRequest(req);
  if (!token) {
    next();
    return;
  }
  const session = verifyPublicCustomerJwt(token);
  if (!session) {
    next();
    return;
  }
  req.publicCustomer = session;
  renewPublicCustomerSession(res, session);
  next();
}
