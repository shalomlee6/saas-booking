import { Injectable, signal, computed } from '@angular/core';

const STORAGE_KEY_TOKEN = 'public_client_token';
const STORAGE_KEY_SLUG = 'public_client_business_slug';
const STORAGE_KEY_CUSTOMER_ID = 'public_client_customer_id';

export interface PublicSession {
  token: string;
  customerId: string;
}

@Injectable({ providedIn: 'root' })
export class PublicSessionService {
  private readonly tokenSignal = signal<string | null>(this.readToken());
  private readonly slugSignal = signal<string | null>(this.readSlug());
  private readonly customerIdSignal = signal<string | null>(this.readCustomerId());

  readonly token = this.tokenSignal.asReadonly();
  readonly businessSlug = this.slugSignal.asReadonly();
  readonly customerId = this.customerIdSignal.asReadonly();
  readonly hasSession = computed(() => !!this.tokenSignal() && !!this.slugSignal());

  private readToken(): string | null {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(STORAGE_KEY_TOKEN);
  }

  private readSlug(): string | null {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(STORAGE_KEY_SLUG);
  }

  private readCustomerId(): string | null {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(STORAGE_KEY_CUSTOMER_ID);
  }

  setSession(token: string, businessSlug: string, customerId?: string): void {
    sessionStorage.setItem(STORAGE_KEY_TOKEN, token);
    sessionStorage.setItem(STORAGE_KEY_SLUG, businessSlug);
    if (customerId != null) {
      sessionStorage.setItem(STORAGE_KEY_CUSTOMER_ID, customerId);
      this.customerIdSignal.set(customerId);
    } else {
      sessionStorage.removeItem(STORAGE_KEY_CUSTOMER_ID);
      this.customerIdSignal.set(null);
    }
    this.tokenSignal.set(token);
    this.slugSignal.set(businessSlug);
  }

  getSession(slug: string): PublicSession | null {
    const t = this.tokenSignal();
    const s = this.slugSignal();
    const c = this.customerIdSignal();
    if (!t || !s || s !== slug) return null;
    return { token: t, customerId: c ?? '' };
  }

  getToken(): string | null {
    return this.tokenSignal();
  }

  getBusinessSlug(): string | null {
    return this.slugSignal();
  }

  clearSession(slug?: string): void {
    if (slug !== undefined && this.slugSignal() !== slug) return;
    sessionStorage.removeItem(STORAGE_KEY_TOKEN);
    sessionStorage.removeItem(STORAGE_KEY_SLUG);
    sessionStorage.removeItem(STORAGE_KEY_CUSTOMER_ID);
    this.tokenSignal.set(null);
    this.slugSignal.set(null);
    this.customerIdSignal.set(null);
  }

  /** True when we have a token for the given slug (same business). */
  hasSessionFor(slug: string): boolean {
    const t = this.tokenSignal();
    const s = this.slugSignal();
    return !!t && !!s && s === slug;
  }
}
