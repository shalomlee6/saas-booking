import type { Response, NextFunction } from 'express';
import type { RequestWithPublicCustomer } from '../types/publicCustomer';
import {
  publicBusinessHint,
  readPublicSessionId,
  renewPublicClientSession,
  setPublicSessionCookie,
} from '../utils/publicCustomerSession';

export type { PublicCustomer, RequestWithPublicCustomer } from '../types/publicCustomer';

/**
 * Optional public session: opaque cookie or Bearer session id.
 * Renews a live session. Never 401s. Old JWTs are ignored.
 */
export function optionalPublicCustomer(
  req: RequestWithPublicCustomer,
  res: Response,
  next: NextFunction
): void {
  const sessionId = readPublicSessionId(req);
  if (!sessionId) {
    next();
    return;
  }
  void renewPublicClientSession(sessionId, publicBusinessHint(req))
    .then((session) => {
      if (session) {
        req.publicCustomer = session;
        setPublicSessionCookie(res, session.sessionId);
      }
      next();
    })
    .catch(next);
}
