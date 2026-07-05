import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DomainTenantService } from '../services/domain-tenant.service';

/**
 * Intercepts requests on custom tenant domains (e.g. chen-nails.co.il) and
 * rewrites them to the canonical /b/:slug/… routes so the rest of the app
 * never has to know about the custom domain.
 *
 * Examples:
 *   chen-nails.co.il/        → /b/chen-nails/landing
 *   chen-nails.co.il/book    → /b/chen-nails/book
 *
 * On the admin domain or localhost the guard is a no-op (returns true).
 */
export const domainTenantGuard: CanActivateFn = (route) => {
  const domainTenant = inject(DomainTenantService);
  const router = inject(Router);

  const slug = domainTenant.tenantSlug();
  if (slug === null) {
    return true;
  }

  // Use the path captured at bootstrap — before Angular's wildcard redirect
  // (`** → ''`) could erase it from the router state.
  const rawPath = domainTenant.originalPath ?? '/';
  const segments = rawPath.split('/').filter((s) => s.length > 0);

  const target =
    segments.length === 0
      ? ['/b', slug, 'landing']
      : ['/b', slug, ...segments];

  return router.createUrlTree(target, { queryParams: route.queryParams });
};
