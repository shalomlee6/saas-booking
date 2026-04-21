import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth.service';

/**
 * Blocks super-admins from the owner (tenant) shell unless they are actively impersonating.
 * Owners, staff, and impersonating super-admins may proceed.
 */
export const ownerPortalGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.initialized()) {
    return router.createUrlTree(['/auth/login']);
  }
  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/auth/login']);
  }
  if (auth.isSuperAdmin() && !auth.isImpersonating()) {
    return router.createUrlTree(['/super-admin']);
  }
  return true;
};
