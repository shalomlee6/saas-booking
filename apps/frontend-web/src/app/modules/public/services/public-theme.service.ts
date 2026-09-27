import { Injectable, signal } from '@angular/core';

export type PublicThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'sb_public_theme';

function resolveInitial(): { mode: PublicThemeMode; explicit: boolean } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return { mode: stored, explicit: true };
  } catch {
    /* localStorage unavailable (private mode, SSR, etc.) — fall through to default */
  }
  return { mode: 'light', explicit: false };
}

/**
 * Light/dark preference for the public customer-facing tenant site only.
 *
 * Deliberately independent from the admin dashboard's `ThemeService` (different
 * storage key, different DOM scope — see `.public-shell.theme-*` in styles.scss
 * vs. `body.theme-*`). A customer toggling dark mode on a tenant's booking site
 * must never flip a staff member's own admin dashboard theme, even in the same
 * browser profile. Mirrors `LanguageService`'s signal + localStorage pattern.
 */
@Injectable({ providedIn: 'root' })
export class PublicThemeService {
  private readonly initial = resolveInitial();
  readonly mode = signal<PublicThemeMode>(this.initial.mode);
  /** True once the customer has made their own explicit choice (persisted). */
  private explicit = this.initial.explicit;

  setMode(mode: PublicThemeMode): void {
    this.explicit = true;
    if (mode === this.mode()) return;
    this.mode.set(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* best-effort persistence only */
    }
  }

  /**
   * Applies a business's configured default mode, but only when the customer
   * hasn't already made their own explicit choice on this site.
   */
  applyBusinessDefault(mode: PublicThemeMode | undefined): void {
    if (this.explicit || !mode || mode === this.mode()) return;
    this.mode.set(mode);
  }
}
