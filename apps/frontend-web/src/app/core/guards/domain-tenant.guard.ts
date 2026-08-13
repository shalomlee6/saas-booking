import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DomainTenantService } from '../services/domain-tenant.service';

/**
 * Intercepts requests on custom tenant domains (e.g. chen-nails.co.il) and
 * rewrites them to the canonical /b/:slug/… routes so the rest of the app
 * never has to know about the custom domain.
 *
 * Examples:
 *   chen-nails.co.il/        → /b/chen-nails
 *   chen-nails.co.il/book    → /b/chen-nails/book
 *
 * On the admin domain or localhost the guard is a no-op (returns true).
 *
 * IMPORTANT: this guard sits on the top-level '' route, which wraps ALL
 * child routes including /b/:slug itself. Without the "already there" check
 * below, it would redirect unconditionally on every navigation -- including
 * the redirect target itself -- causing an infinite redirect loop.
 */
export const domainTenantGuard: CanActivateFn = (route) => {
  const domainTenant = inject(DomainTenantService);
  const router = inject(Router);

  const slug = domainTenant.tenantSlug();
  if (slug === null) {
    return true;
  }

  // Already navigating within /b/:slug — don't redirect again.
  const targetingUrl = router.getCurrentNavigation()?.extractedUrl.toString() ?? router.url;
  if (targetingUrl === `/b/${slug}` || targetingUrl.startsWith(`/b/${slug}/`)) {
    return true;
  }

  // Use the path captured at bootstrap — before Angular's wildcard redirect
  // (`** → ''`) could erase it from the router state.
  const rawPath = domainTenant.originalPath ?? '/';
  const segments = rawPath.split('/').filter((s) => s.length > 0);

  const target =
    segments.length === 0
      ? ['/b', slug]
      : ['/b', slug, ...segments];

  return router.createUrlTree(target, { queryParams: route.queryParams });
};