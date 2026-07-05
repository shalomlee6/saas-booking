import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

const SESSION_KEY = 'tenantSlug';

@Injectable({ providedIn: 'root' })
export class DomainTenantService {
  /** The slug extracted from the custom domain, or null on the admin domain / localhost. */
  readonly tenantSlug = signal<string | null>(null);

  /**
   * The raw browser path captured at app bootstrap (before Angular's router
   * potentially rewrites it via wildcard redirects).  Used by domainTenantGuard
   * to reconstruct the intended /b/{slug}/… destination.
   */
  readonly originalPath: string | null = null;

  constructor() {
    const hostname = window.location.hostname;
    const isLocalhost =
      hostname === 'localhost' || hostname === '127.0.0.1';
    const isAdminDomain = hostname === (environment as any).adminDomain;

    if (!isLocalhost && !isAdminDomain) {
      const slug = hostname.split('.')[0];
      this.tenantSlug.set(slug);
      this.originalPath = window.location.pathname;
      sessionStorage.setItem(SESSION_KEY, slug);
    }
  }
}
