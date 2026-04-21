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
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};
