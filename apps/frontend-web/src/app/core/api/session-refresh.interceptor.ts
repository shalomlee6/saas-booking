import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { AuthService } from '../auth/auth.service';

/**
 * Picks up sliding-session JWTs re-issued by the API on authenticated requests.
 * Impersonation tokens are never sent in these headers.
 */
export const sessionRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  return next(req).pipe(
    tap((event) => {
      if (!(event instanceof HttpResponse)) return;

      const staffToken = event.headers.get('X-Refreshed-Token');
      if (staffToken) {
        auth.recordSessionExpiryFromJwt(staffToken);
      }
    })
  );
};
