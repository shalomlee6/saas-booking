import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.initialized()) {
    // Already initialized — decide immediately
    if (auth.isClientSessionExpired()) {
      auth.handleUnauthorizedRedirect();
      return false;
    }
    return auth.isLoggedIn() ? true : router.createUrlTree(['/auth/login']);
  }

  // Wait for initialization
  return toObservable(auth.initialized).pipe(
    filter((initialized) => initialized),
    take(1),
    map(() => {
      if (auth.isClientSessionExpired()) {
        auth.handleUnauthorizedRedirect();
        return false;
      }
      return auth.isLoggedIn() ? true : router.createUrlTree(['/auth/login']);
    })
  );
};
