import type { Response, NextFunction } from 'express';
import type { RequestWithPublicCustomer } from '../types/publicCustomer';
import {
  publicBusinessHint,
  readPublicSessionId,
  renewPublicClientSession,
  setPublicSessionCookie,
} from '../utils/publicCustomerSession';

/** Requires a live public client session. Does not require the session to be verified. */
export function requirePublicCustomer(
  req: RequestWithPublicCustomer,
  res: Response,
  next: NextFunction
): void {
  const sessionId = readPublicSessionId(req);
  if (!sessionId) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }
  void renewPublicClientSession(sessionId, publicBusinessHint(req))
    .then((session) => {
      if (!session) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }
      req.publicCustomer = session;
      setPublicSessionCookie(res, session.sessionId);
      next();
    })
    .catch(next);
}
