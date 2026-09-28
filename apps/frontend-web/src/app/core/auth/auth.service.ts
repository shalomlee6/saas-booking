import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, map } from 'rxjs';
import { ApiService } from '../api/api.service';
import type { BusinessUi } from '../config/theme.service';
import { ThemeService } from '../config/theme.service';
import { decodeJwtExpMs } from './jwt-session.util';
import { AppointmentsApiService } from '../../modules/appointments/services/appointments-api.service';
import { GrowthBrainService } from '../../modules/dashboard/services/growth-brain.service';

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
  /** Public tenant site theme preset id (see core/theming/theme-presets.ts). */
  preset?: string;
  /** Business-configured default light/dark mode for the public site. */
  defaultMode?: 'light' | 'dark';
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
/** Client hint: JWT exp in ms from last login/register response (cookie is source of truth). */
const SS_SESSION_EXP_MS = 'sb_session_exp_ms';

function lsGet(key: string): string | null {
  return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly appointmentsApi = inject(AppointmentsApiService);
  private readonly growthBrain = inject(GrowthBrainService);

  /** Prevents duplicate redirects when several API calls return 401 at once. */
  private loggingOut = false;

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
        const u = res?.user;
        if (!u) {
          this.user.set(null);
          this.business.set(null);
          this.businessSettings.set(null);
          this.initialized.set(true);
          this.clearSessionExpiryHint();
          return;
        }
        this.user.set(u);
        this.business.set(res.business ?? null);
        this.businessSettings.set(res.businessSettings ?? null);
        this.initialized.set(true);

        // The super-admin panel is permanently light and unaffected by any
        // business — see ThemeService/styles.scss. Only an owner's own login,
        // or an impersonated business, derives its mode from that business's
        // own ui.themeMode.
        const isSuperAdmin = u.role === 'super_admin' && !this._impersonationToken();
        const mode: 'light' | 'dark' = isSuperAdmin
          ? 'light'
          : res.business?.ui?.themeMode === 'dark'
            ? 'dark'
            : 'light';
        const businessTheme = isSuperAdmin
          ? null
          : ThemeService.toBusinessThemeOverrides(res.business?.ui, res.businessSettings?.theme ?? undefined);
        this.theme.applyAll({ mode, businessTheme });
      }),
      map(() => undefined),
      catchError(() => {
        // A stale impersonation token (its target business was deleted, or it
        // expired) fails /me the same way a dead session does. Drop it here
        // rather than leaving it in localStorage, where it would keep being
        // sent and keep failing on every subsequent /me call.
        if (this._impersonationToken()) {
          this.stopImpersonation();
        }
        this.user.set(null);
        this.business.set(null);
        this.businessSettings.set(null);
        this.initialized.set(true);
        this.clearSessionExpiryHint();
        return of(undefined);
      })
    );
  }

  isLoggedIn(): boolean {
    return this.user() != null;
  }

  /**
   * When login/register returns a JWT in the body, store `exp` for guard checks.
   * The session cookie remains the authoritative credential.
   */
  recordSessionExpiryFromJwt(token: string | null | undefined): void {
    if (!token || typeof sessionStorage === 'undefined') return;
    const expMs = decodeJwtExpMs(token);
    if (expMs != null) {
      sessionStorage.setItem(SS_SESSION_EXP_MS, String(expMs));
    }
  }

  /** True when we have a stored exp and the browser clock is past it. */
  isClientSessionExpired(): boolean {
    if (typeof sessionStorage === 'undefined') return false;
    const raw = sessionStorage.getItem(SS_SESSION_EXP_MS);
    if (!raw) return false;
    const exp = Number(raw);
    if (!Number.isFinite(exp)) return false;
    return Date.now() >= exp;
  }

  clearSessionExpiryHint(): void {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SS_SESSION_EXP_MS);
    }
  }

  private clearLocalSessionOnly(): void {
    this.stopImpersonation();
    this.user.set(null);
    this.business.set(null);
    this.businessSettings.set(null);
    this.clearSessionExpiryHint();
    this.appointmentsApi.invalidateTenantScope();
    this.growthBrain.invalidateTenantScope();
  }

  /**
   * Clears owner session state and navigates to login.
   * Call after 401 or expired client hint.
   */
  handleUnauthorizedRedirect(): void {
    if (this.loggingOut) return;
    this.loggingOut = true;
    this.clearLocalSessionOnly();
    this.api.post('auth/logout', {}).subscribe({
      next: () => {
        this.loggingOut = false;
        void this.router.navigate(['/auth/login']);
      },
      error: () => {
        this.loggingOut = false;
        void this.router.navigate(['/auth/login']);
      },
    });
  }

  /** Logout from sidebar: clear server cookie, local state, navigate to login. */
  logout(): void {
    if (this.loggingOut) return;
    this.loggingOut = true;
    this.clearLocalSessionOnly();
    this.api.post('auth/logout', {}).subscribe({
      next: () => {
        this.loggingOut = false;
        void this.router.navigate(['/auth/login']);
      },
      error: () => {
        this.loggingOut = false;
        void this.router.navigate(['/auth/login']);
      },
    });
  }

  isSuperAdmin(): boolean {
    return this.user()?.role === 'super_admin';
  }

  /**
   * Self-service password change for the logged-in user (super-admin, owner, or
   * staff). The backend re-issues a fresh session cookie for THIS session while
   * invalidating every other outstanding one, so no client-side session handling
   * is needed here beyond surfacing success/failure to the caller.
   */
  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('auth/change-password', {
      currentPassword,
      newPassword,
    });
  }

  /** Active business name (own business or impersonated). */
  readonly activeBusinessName = computed(() => this.business()?.name ?? null);

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
