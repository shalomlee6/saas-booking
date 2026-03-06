import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { PublicSessionService } from '../services/public-session.service';

/**
 * Adds Authorization: Bearer <token> to requests to POST /api/public/appointments
 * when the user has a public customer session, so the server can identify the customer.
 */
export const publicCustomerAuthInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/api/public/appointments') || req.method !== 'POST') {
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
