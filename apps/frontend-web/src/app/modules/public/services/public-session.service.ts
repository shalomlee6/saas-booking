import { Injectable, computed, signal } from '@angular/core';
import type { BirthdayField, IdentityMode } from './public-identity.rules';
import { readyToBook, type PublicClientProfile } from './public-identity.rules';

const STORAGE_KEY_TOKEN = 'public_client_token';
const STORAGE_KEY_SLUG = 'public_client_business_slug';
const STORAGE_KEY_CUSTOMER_ID = 'public_client_customer_id';
const STORAGE_KEY_CUSTOMER_NAME = 'public_client_customer_name';

@Injectable({ providedIn: 'root' })
export class PublicSessionService {
  private readonly profileSignal = signal<PublicClientProfile | null>(null);
  private readonly slugSignal = signal<string | null>(null);
  private readonly customerIdSignal = signal<string | null>(null);
  private readonly modeSignal = signal<IdentityMode | null>(null);
  private readonly birthdaySignal = signal<BirthdayField | null>(null);
  readonly flowEpoch = signal(0);

  readonly identityMode = this.modeSignal.asReadonly();
  readonly birthdayField = this.birthdaySignal.asReadonly();
  readonly customerId = this.customerIdSignal.asReadonly();
  readonly customerName = computed(() => {
    const profile = this.profileSignal();
    if (!profile?.verified) return null;
    return profile.firstName ?? null;
  });

  constructor() {
    this.clearLegacyToken();
  }

  setConfig(mode: IdentityMode, birthdayField: BirthdayField): void {
    this.modeSignal.set(mode);
    this.birthdaySignal.set(birthdayField);
  }

  applyMe(slug: string, profile: PublicClientProfile): void {
    this.slugSignal.set(slug);
    this.profileSignal.set(profile);
  }

  rememberCustomerId(customerId: string): void {
    this.customerIdSignal.set(customerId);
  }

  readyToBook(slug: string): boolean {
    if (this.slugSignal() !== slug) return false;
    return readyToBook(this.profileSignal());
  }

  /** Verified session for this business — required before listing appointments. */
  hasSessionFor(slug: string): boolean {
    const profile = this.profileSignal();
    return this.slugSignal() === slug && !!profile?.verified && profile.hasCustomer;
  }

  clearSession(slug?: string): void {
    if (slug !== undefined && this.slugSignal() !== slug) return;
    this.profileSignal.set(null);
    this.slugSignal.set(null);
    this.customerIdSignal.set(null);
    this.clearLegacyToken();
  }

  bumpFlow(): void {
    this.flowEpoch.update((value) => value + 1);
  }

  private clearLegacyToken(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_SLUG);
      localStorage.removeItem(STORAGE_KEY_CUSTOMER_ID);
      localStorage.removeItem(STORAGE_KEY_CUSTOMER_NAME);
    } catch {
      /* ignore */
    }
  }
}
