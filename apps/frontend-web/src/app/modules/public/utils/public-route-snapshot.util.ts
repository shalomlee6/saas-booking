import { ActivatedRouteSnapshot } from '@angular/router';

/** Walks ancestors to find `:slug` from `/b/:slug/...` public routes. */
export function readBusinessSlugFromSnapshot(
  route: ActivatedRouteSnapshot
): string | null {
  let r: ActivatedRouteSnapshot | null = route;
  while (r) {
    const s = r.paramMap.get('slug');
    if (s) return s;
    r = r.parent;
  }
  return null;
}
