import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../auth.service';

/**
 * Blocks super-admins from the owner (tenant) shell unless they are actively impersonating.
 * Owners, staff, and impersonating super-admins may proceed.
 */
export const ownerPortalGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.initialized()) {
    if (!auth.isLoggedIn()) {
      return router.createUrlTree(['/auth/login']);
    }
    if (auth.isSuperAdmin() && !auth.isImpersonating()) {
      return router.createUrlTree(['/super-admin']);
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
      if (auth.isSuperAdmin() && !auth.isImpersonating()) {
        return router.createUrlTree(['/super-admin']);
      }
      return true;
    })
  );
};
