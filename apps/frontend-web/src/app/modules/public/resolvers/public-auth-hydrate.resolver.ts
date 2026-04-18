import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { of } from 'rxjs';
import { map } from 'rxjs/operators';
import { PublicApiService } from '../services/public-api.service';
import { PublicSessionService } from '../services/public-session.service';
import { readBusinessSlugFromSnapshot } from '../utils/public-route-snapshot.util';

/**
 * Before any public-site child route activates, calls GET /api/public/auth/me
 * to sync customer state and clear a stale token when the server returns 401.
 */
export const publicAuthHydrateResolver: ResolveFn<boolean> = (route) => {
  const slug = readBusinessSlugFromSnapshot(route);
  const publicApi = inject(PublicApiService);
  const session = inject(PublicSessionService);

  if (!slug) {
    return of(true);
  }

  return publicApi.getPublicAuthMe().pipe(
    map((result) => {
      if (result.kind === 'ok') {
        if (result.me.slug !== slug) {
          session.clearSession();
        } else {
          session.applyPublicAuthMe(result.me);
        }
        return true;
      }
      if (result.kind === 'unauthorized' && session.hasSessionFor(slug)) {
        session.clearSession(slug);
      }
      return true;
    })
  );
};
