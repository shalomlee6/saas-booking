import type { Response, NextFunction } from 'express';
import type { RequestWithPublicCustomer } from '../types/publicCustomer';
import {
  getPublicCustomerJwtFromRequest,
  renewPublicCustomerSession,
  verifyPublicCustomerJwt,
} from '../utils/publicCustomerSession';

/**
 * Requires a valid public customer session (Bearer or HTTP-only cookie from verify-otp).
 */
export function requirePublicCustomer(
  req: RequestWithPublicCustomer,
  res: Response,
  next: NextFunction
): void {
  const token = getPublicCustomerJwtFromRequest(req);
  if (!token) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }
  const session = verifyPublicCustomerJwt(token);
  if (!session) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }
  req.publicCustomer = session;
  renewPublicCustomerSession(res, session);
  next();
}
