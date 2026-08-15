import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { PublicSessionService } from '../services/public-session.service';

/**
 * Adds Authorization: Bearer <token> to all requests that require public customer identity.
 *
 * Rule: any request whose URL contains `/api/public/appointments` or
 * `/api/public/auth/me` gets the token when present. This covers:
 *  - POST   /api/public/appointments          (booking creation)
 *  - GET    /api/public/appointments/upcoming (home page upcoming appointment)
 *  - DELETE /api/public/appointments/:id      (customer cancellation)
 *  - GET    /api/public/auth/me               (hydrate session on load)
 *
 * The token is sourced from PublicSessionService (localStorage).
 * If no token exists the request proceeds without a Bearer header (the
 * browser may still send the public customer HTTP-only cookie on `/api/public/*`).
 */
export const publicCustomerAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const needsCustomerAuth =
    req.url.includes('/api/public/appointments') || req.url.includes('/api/public/auth/me');
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
