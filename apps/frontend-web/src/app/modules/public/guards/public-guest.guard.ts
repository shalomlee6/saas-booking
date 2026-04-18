import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PublicSessionService } from '../services/public-session.service';
import { readBusinessSlugFromSnapshot } from '../utils/public-route-snapshot.util';

/** Keeps authenticated customers off OTP login; home is `/b/:slug`. */
export const publicGuestGuard: CanActivateFn = (route) => {
  const session = inject(PublicSessionService);
  const router = inject(Router);
  const slug = readBusinessSlugFromSnapshot(route);
  if (!slug) {
    return true;
  }
  if (session.hasSessionFor(slug)) {
    return router.createUrlTree(['/b', slug]);
  }
  return true;
};
