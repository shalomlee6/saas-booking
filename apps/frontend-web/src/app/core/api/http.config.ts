import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

/**
 * Super-admin impersonation: Bearer token.
 * Owner sessions use the httpOnly `sb_token` cookie (`withCredentials` on ApiService).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('sb_impersonation_token')
      : null;
  if (token) {
    const cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    return next(cloned);
  }
  return next(req);
};

/** On 401 from owner API, clear session and send user to login (cookie may be expired). */
export const unauthorizedInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
        return throwError(() => err);
      }
      const url = req.url;
      if (
        url.includes('/api/public/') ||
        url.includes('/api/auth/login') ||
        url.includes('/api/auth/register') ||
        url.includes('/api/auth/logout') ||
        url.includes('/api/auth/me')
      ) {
        return throwError(() => err);
      }
      auth.handleUnauthorizedRedirect();
      return throwError(() => err);
    })
  );
};
