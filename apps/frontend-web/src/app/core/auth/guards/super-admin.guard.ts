import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../auth.service';

export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.initialized()) {
    if (!auth.isLoggedIn()) {
      return router.createUrlTree(['/auth/login']);
    }
    if (!auth.isSuperAdmin()) {
      return router.createUrlTree(['/dashboard']);
    }
    return true;
  }

  return toObservable(auth.initialized).pipe(
    filter((initialized) => initialized),
    take(1),
    map(() => {
      if (!auth.isLoggedIn()) {
        return router.createUrlTree(['/auth/login']);
      }
      if (!auth.isSuperAdmin()) {
        return router.createUrlTree(['/dashboard']);
      }
      return true;
    })
  );
};
