import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth.service';

export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.initialized()) {
    return false;
  }
  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/auth/login']);
  }
  if (!auth.isSuperAdmin()) {
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};
