import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth.service';

/** Prevents authenticated owners from opening login/register. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.initialized()) {
    return true;
  }
  if (auth.isLoggedIn()) {
    if (auth.isSuperAdmin()) {
      return router.createUrlTree(['/super-admin']);
    }
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};
