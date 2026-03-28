import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable, tap, catchError, of, map } from 'rxjs';
import { ApiService } from '../api/api.service';
import type { BusinessUi } from '../config/theme.service';
import { ThemeService } from '../config/theme.service';

export interface User {
  id: string;
  email: string;
  role: string;
  businessId?: string;
  businessSlug?: string;
}

/** From BusinessSettings.theme (backend) */
export interface BusinessSettingsTheme {
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  logoUrl?: string | null;
  fontFamily?: string;
}

/** One day: 48 slots (30-min each, 00:00..23:30). true = available. */
export interface WorkingHoursDay {
  enabled: boolean;
  start: string;
  end: string;
  slots: boolean[];
}

/** Keys: sun, mon, tue, wed, thu, fri, sat (Sunday first). */
export type WorkingHours = Record<string, WorkingHoursDay>;

export interface AuthMeBusiness {
  _id: string;
  name: string;
  slug: string;
  ui?: BusinessUi;
  ownerEmail?: string | null;
}

export interface AuthMeResponse {
  user: User;
  business?: AuthMeBusiness | null;
  businessSettings?: {
    theme: BusinessSettingsTheme | null;
    workingHours?: WorkingHours | null;
    localization?: {
      timezone?: string;
    } | null;
  } | null;
}

const LS_IMPERSONATION_TOKEN = 'sb_impersonation_token';
const LS_IMPERSONATION_BIZ_ID = 'sb_impersonation_business_id';

function lsGet(key: string): string | null {
  return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly theme = inject(ThemeService);

  readonly user = signal<User | null>(null);
  readonly business = signal<AuthMeBusiness | null>(null);
  readonly businessSettings = signal<AuthMeResponse['businessSettings']>(null);
  readonly initialized = signal<boolean>(false);

  // ── Impersonation reactive state ───────────────────────────────────────────
  // Seeded from localStorage so state survives a hard refresh correctly.
  private readonly _impersonationToken = signal<string | null>(lsGet(LS_IMPERSONATION_TOKEN));
  private readonly _impersonatingBusinessId = signal<string | null>(lsGet(LS_IMPERSONATION_BIZ_ID));

  /** True when super-admin is currently impersonating a business. Reactive. */
  readonly isImpersonating = computed(() => !!this._impersonationToken());

  /** Id of the business being impersonated, or null. Reactive. */
  readonly impersonatingBusinessId = computed(() => this._impersonatingBusinessId());

  /**
   * IANA timezone for the active business (e.g. 'Asia/Jerusalem').
   * Used by the appointments calendar to render appointment blocks and labels
   * in the business's local time, not the browser's local time.
   * Falls back to 'Asia/Jerusalem' (the target market default) when settings
   * haven't loaded yet or don't include a timezone.
   */
  readonly businessTimezone = computed(
    () => this.businessSettings()?.localization?.timezone ?? 'Asia/Jerusalem'
  );

  init(): Observable<void> {
    return this.api.get<AuthMeResponse>('auth/me').pipe(
      tap((res) => {
        this.user.set(res.user);
        this.business.set(res.business ?? null);
        this.businessSettings.set(res.businessSettings ?? null);
        this.initialized.set(true);

        // Super admin: use localStorage sb_theme for light/dark. Owners: use business theme only (ignore sb_theme for mode).
        const isSuperAdmin = res.user?.role === 'super_admin';
        const mode = isSuperAdmin
          ? ((typeof localStorage !== 'undefined' && (localStorage.getItem('sb_theme') as 'light' | 'dark' | null)) === 'dark' ? 'dark' : 'light')
          : (res.business?.ui?.themeMode === 'dark' ? 'dark' : 'light');
        const businessTheme = ThemeService.toBusinessThemeOverrides(
          res.business?.ui,
          res.businessSettings?.theme ?? undefined
        );
        this.theme.applyAll({ mode, businessTheme });
      }),
      map(() => undefined),
      catchError(() => {
        this.user.set(null);
        this.business.set(null);
        this.businessSettings.set(null);
        this.initialized.set(true);
        return of(undefined);
      })
    );
  }

  isLoggedIn(): boolean {
    return this.user() !== null;
  }

  isSuperAdmin(): boolean {
    return this.user()?.role === 'super_admin';
  }

  /** Active business name (own business or impersonated). */
  activeBusinessName(): string | null {
    return this.business()?.name ?? null;
  }

  /**
   * Begin impersonating a business.
   * Writes to localStorage (so authInterceptor picks it up per-request)
   * and updates the reactive signals immediately so the UI responds without a reload.
   */
  startImpersonation(token: string, businessId: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_IMPERSONATION_TOKEN, token);
      localStorage.setItem(LS_IMPERSONATION_BIZ_ID, businessId);
    }
    this._impersonationToken.set(token);
    this._impersonatingBusinessId.set(businessId);
  }

  /**
   * Stop impersonating.
   * Removes from localStorage and clears the reactive signals immediately.
   */
  stopImpersonation(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LS_IMPERSONATION_TOKEN);
      localStorage.removeItem(LS_IMPERSONATION_BIZ_ID);
    }
    this._impersonationToken.set(null);
    this._impersonatingBusinessId.set(null);
  }

  /** Update businessSettings locally (e.g. after PATCH business/settings). */
  updateBusinessSettings(partial: Partial<NonNullable<AuthMeResponse['businessSettings']>>): void {
    const current = this.businessSettings();
    if (current) {
      this.businessSettings.set({ ...current, ...partial });
    }
  }
}
