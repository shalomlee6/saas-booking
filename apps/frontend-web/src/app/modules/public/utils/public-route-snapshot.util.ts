import { ActivatedRoute, ActivatedRouteSnapshot } from '@angular/router';

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

/**
 * Resolves `slug` from `/b/:slug/...` by scanning `pathFromRoot` (root → leaf).
 * Prefer over `route.parent?.parent` so extra lazy children under public layout do not break.
 */
export function readBusinessSlugFromPathFromRoot(route: ActivatedRoute): string {
  for (const seg of route.pathFromRoot) {
    const s = seg.snapshot.paramMap.get('slug');
    if (s) return s;
  }
  return '';
}
