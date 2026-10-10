import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { PublicSessionService } from '../services/public-session.service';

/**
 * Adds Authorization: Bearer <token> when a public client token exists.
 * The live session is the httpOnly cookie on `/api/public/*`. getToken() is
 * null for that cookie session, so these requests still go out and the
 * browser attaches the cookie.
 */
export const publicCustomerAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const needsCustomerAuth = req.url.includes('/api/public/appointments');
  if (!needsCustomerAuth) {
    return next(req);
  }
  const session = inject(PublicSessionService);
  const token = session.getToken();
  if (!token) return next(req);
  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    })
  );
};
