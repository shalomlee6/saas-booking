import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { PublicApiService } from '../services/public-api.service';
import { PublicSessionService } from '../services/public-session.service';
import { readBusinessSlugFromSnapshot } from '../utils/public-route-snapshot.util';

/** Loads public config and the device session before the public site renders. */
export const publicAuthHydrateResolver: ResolveFn<boolean> = (route) => {
  const slug = readBusinessSlugFromSnapshot(route);
  const publicApi = inject(PublicApiService);
  const session = inject(PublicSessionService);

  if (!slug) return of(true);

  return forkJoin({
    config: publicApi.getPublicConfig(slug).pipe(catchError(() => of(null))),
    me: publicApi.getSessionMe(slug),
  }).pipe(
    map(({ config, me }) => {
      if (config) session.setConfig(config.identityMode, config.birthdayField);
      if (me.kind === 'ok') session.applyMe(slug, me.profile);
      else session.clearSession(slug);
      return true;
    })
  );
};
