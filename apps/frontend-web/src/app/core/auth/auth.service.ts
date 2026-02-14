import { Injectable, signal, inject } from '@angular/core';
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

/** One day in weekly working hours. start/end in HH:mm. */
export interface WorkingHoursDay {
  enabled: boolean;
  start: string;
  end: string;
}

/** Keys: mon, tue, wed, thu, fri, sat, sun */
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
  } | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly theme = inject(ThemeService);

  readonly user = signal<User | null>(null);
  readonly business = signal<AuthMeBusiness | null>(null);
  readonly businessSettings = signal<AuthMeResponse['businessSettings']>(null);
  readonly initialized = signal<boolean>(false);

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

  /** Update businessSettings locally (e.g. after PATCH business/settings). */
  updateBusinessSettings(partial: Partial<NonNullable<AuthMeResponse['businessSettings']>>): void {
    const current = this.businessSettings();
    if (current) {
      this.businessSettings.set({ ...current, ...partial });
    }
  }
}
