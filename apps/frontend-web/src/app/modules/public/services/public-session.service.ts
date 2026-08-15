import { Injectable, signal, computed } from '@angular/core';
import type { PublicAuthMeResponse } from './public-api.service';

const STORAGE_KEY_TOKEN = 'public_client_token';
const STORAGE_KEY_SLUG = 'public_client_business_slug';
const STORAGE_KEY_CUSTOMER_ID = 'public_client_customer_id';
const STORAGE_KEY_CUSTOMER_NAME = 'public_client_customer_name';

export interface PublicSession {
  token: string;
  customerId: string;
}

function storageAvailable(): boolean {
  return typeof localStorage !== 'undefined';
}

/** Prefer localStorage; migrate leftover sessionStorage keys from the previous tab-scoped store. */
function readPersisted(key: string): string | null {
  if (!storageAvailable()) return null;
  const fromLocal = localStorage.getItem(key);
  if (fromLocal) return fromLocal;
  if (typeof sessionStorage === 'undefined') return null;
  const fromSession = sessionStorage.getItem(key);
  if (!fromSession) return null;
  localStorage.setItem(key, fromSession);
  sessionStorage.removeItem(key);
  return fromSession;
}

function writePersisted(key: string, value: string): void {
  if (!storageAvailable()) return;
  localStorage.setItem(key, value);
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(key);
  }
}

function removePersisted(key: string): void {
  if (storageAvailable()) localStorage.removeItem(key);
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key);
}

@Injectable({ providedIn: 'root' })
export class PublicSessionService {
  private readonly tokenSignal = signal<string | null>(this.readToken());
  private readonly slugSignal = signal<string | null>(this.readSlug());
  private readonly customerIdSignal = signal<string | null>(this.readCustomerId());
  private readonly customerNameSignal = signal<string | null>(this.readCustomerName());

  readonly token = this.tokenSignal.asReadonly();
  readonly businessSlug = this.slugSignal.asReadonly();
  readonly customerId = this.customerIdSignal.asReadonly();
  /** Display name for the authenticated customer, or null for guests. */
  readonly customerName = this.customerNameSignal.asReadonly();
  readonly hasSession = computed(() => !!this.tokenSignal() && !!this.slugSignal());

  private readToken(): string | null {
    return readPersisted(STORAGE_KEY_TOKEN);
  }

  private readSlug(): string | null {
    return readPersisted(STORAGE_KEY_SLUG);
  }

  private readCustomerId(): string | null {
    return readPersisted(STORAGE_KEY_CUSTOMER_ID);
  }

  private readCustomerName(): string | null {
    return readPersisted(STORAGE_KEY_CUSTOMER_NAME);
  }

  setSession(token: string, businessSlug: string, customerId?: string, customerName?: string): void {
    writePersisted(STORAGE_KEY_TOKEN, token);
    writePersisted(STORAGE_KEY_SLUG, businessSlug);
    if (customerId != null) {
      writePersisted(STORAGE_KEY_CUSTOMER_ID, customerId);
      this.customerIdSignal.set(customerId);
    } else {
      removePersisted(STORAGE_KEY_CUSTOMER_ID);
      this.customerIdSignal.set(null);
    }
    if (customerName) {
      writePersisted(STORAGE_KEY_CUSTOMER_NAME, customerName);
      this.customerNameSignal.set(customerName);
    } else {
      removePersisted(STORAGE_KEY_CUSTOMER_NAME);
      this.customerNameSignal.set(null);
    }
    this.tokenSignal.set(token);
    this.slugSignal.set(businessSlug);
  }

  /** Replace only the JWT after a sliding-session renewal (keeps slug / id / name). */
  updateToken(token: string): void {
    writePersisted(STORAGE_KEY_TOKEN, token);
    this.tokenSignal.set(token);
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
    removePersisted(STORAGE_KEY_TOKEN);
    removePersisted(STORAGE_KEY_SLUG);
    removePersisted(STORAGE_KEY_CUSTOMER_ID);
    removePersisted(STORAGE_KEY_CUSTOMER_NAME);
    this.tokenSignal.set(null);
    this.slugSignal.set(null);
    this.customerIdSignal.set(null);
    this.customerNameSignal.set(null);
  }

  /** True when we have a token for the given slug (same business). */
  hasSessionFor(slug: string): boolean {
    const t = this.tokenSignal();
    const s = this.slugSignal();
    return !!t && !!s && s === slug;
  }

  /**
   * Refreshes display fields from GET /api/public/auth/me.
   * Requires an existing Bearer token in session (same flow as verify-otp).
   */
  applyPublicAuthMe(me: PublicAuthMeResponse): void {
    const token = this.getToken();
    if (!token) {
      return;
    }
    const displayName =
      (me.name && me.name.trim()) ||
      [me.firstName, me.lastName].filter(Boolean).join(' ').trim() ||
      undefined;
    this.setSession(token, me.slug, me.id, displayName);
  }
}
