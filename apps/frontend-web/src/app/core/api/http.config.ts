import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
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

let lastRateLimitToastAt = 0;

/** Surfaces a 429 as a toast instead of letting it fail silently (or as a raw console error). */
export const rateLimitInterceptor: HttpInterceptorFn = (req, next) => {
  const messageService = inject(MessageService);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 429) {
        return throwError(() => err);
      }
      // Debounce: a burst of failed requests under the same limit shouldn't stack toasts.
      const now = Date.now();
      if (now - lastRateLimitToastAt > 4000) {
        lastRateLimitToastAt = now;
        const retryAfterRaw = err.error?.retryAfter ?? err.headers?.get?.('Retry-After');
        const retryAfterSeconds = Number(retryAfterRaw);
        const detail = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? `יותר מדי בקשות. נסו שוב בעוד ${retryAfterSeconds} שניות.`
          : 'יותר מדי בקשות. נסו שוב בעוד כמה רגעים.';
        messageService.add({
          severity: 'warn',
          summary: 'הגעת למגבלת הבקשות',
          detail,
          life: 6000,
        });
      }
      return throwError(() => err);
    })
  );
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
        url.includes('/api/auth/forgot-password') ||
        url.includes('/api/auth/reset-password') ||
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
