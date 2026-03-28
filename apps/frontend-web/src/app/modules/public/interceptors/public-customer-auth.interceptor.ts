import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { PublicSessionService } from '../services/public-session.service';

/**
 * Adds Authorization: Bearer <token> to all requests that require public customer identity.
 *
 * Rule: any request whose URL contains `/api/public/appointments` gets the token,
 * regardless of HTTP method. This covers:
 *  - POST   /api/public/appointments          (booking creation)
 *  - GET    /api/public/appointments/upcoming (home page upcoming appointment)
 *  - DELETE /api/public/appointments/:id      (customer cancellation)
 *
 * The token is sourced from PublicSessionService (sessionStorage).
 * If no token exists the request proceeds unauthenticated — the backend
 * handles the missing-auth case with optionalPublicCustomer middleware.
 */
export const publicCustomerAuthInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/api/public/appointments')) {
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
