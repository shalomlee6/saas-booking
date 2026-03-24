import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { PublicSessionService } from '../services/public-session.service';

/**
 * Adds Authorization: Bearer <token> to requests that require public customer identity:
 *  - POST /api/public/appointments  (booking creation)
 *  - GET  /api/public/appointments/upcoming  (home page upcoming appointment)
 */
export const publicCustomerAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const isBookingPost =
    req.url.includes('/api/public/appointments') && req.method === 'POST';
  const isUpcomingGet =
    req.url.includes('/api/public/appointments/upcoming') && req.method === 'GET';
  if (!isBookingPost && !isUpcomingGet) {
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
