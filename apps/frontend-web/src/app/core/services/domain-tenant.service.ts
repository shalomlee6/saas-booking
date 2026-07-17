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
    const raw = window.location.hostname;
    // Strip a leading "www." so both bare and www-prefixed hostnames are handled
    // consistently — both for the admin-domain check and for slug extraction.
    const hostname = raw.startsWith('www.') ? raw.slice(4) : raw;

    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isAdminDomain = hostname === (environment as any).adminDomain;

    if (!isLocalhost && !isAdminDomain) {
      // hostname is now guaranteed to be stripped of "www.", so split('.')[0]
      // gives the true business slug (e.g. "chen-nails" from "chen-nails.co.il").
      const slug = hostname.split('.')[0];
      this.tenantSlug.set(slug);
      this.originalPath = window.location.pathname;
      sessionStorage.setItem(SESSION_KEY, slug);
    }
  }
}
