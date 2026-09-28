import { Injectable, computed, signal } from '@angular/core';

/** From Business.ui (dashboard) */
export interface BusinessUi {
  themeMode?: 'light' | 'dark';
  primaryColor?: string;
  sidebarColor?: string;
  backgroundColor?: string;
  logoUrl?: string;
  dashboardLayout?: 'classic' | 'compact';
}

/** From BusinessSettings.theme (DB collection) */
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

/** Unified shape for theme overrides (primary, sidebar, background) */
export interface BusinessThemeOverrides {
  primaryColor?: string;
  sidebarColor?: string;
  backgroundColor?: string;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;
function validHex(s: string | undefined): boolean {
  return typeof s === 'string' && HEX.test(s);
}

const DEFAULTS = {
  primaryColor: '#F35271',
  sidebarColor: '#0F172A',
  backgroundColor: '#F6F8FB',
};

/**
 * Business owner dashboard theme (light/dark + a business's own accent color).
 * Purely reactive — holds state as signals that `LayoutComponent`'s template
 * binds onto its own `.layout` root ([class.theme-dark] / [ngStyle]), instead
 * of this service reaching into the DOM itself. This is what keeps the theme
 * scoped to the dashboard shell: nothing here ever touches `document.body` or
 * any other element, so there is no global state for a business's theme (or
 * impersonation) to leak into the super-admin panel, which never binds to
 * these signals at all and is permanently styled by the `:root` defaults in
 * styles.scss.
 *
 * No localStorage involved: the super-admin's own view is always light (a
 * fixed design decision, not a personal preference), and the owner/impersonated
 * view's mode always comes fresh from the business's own `ui.themeMode` on the
 * server — so there's nothing to persist and nothing that can go stale.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<'light' | 'dark'>('light');
  private readonly businessTheme = signal<BusinessThemeOverrides | null>(null);

  /** CSS custom-property overrides for the dashboard shell root's [ngStyle] binding. */
  readonly cssVars = computed<Record<string, string>>(() => {
    const t = this.businessTheme();
    if (!t) return {};
    const vars: Record<string, string> = {
      '--color-primary': t.primaryColor && validHex(t.primaryColor) ? t.primaryColor : DEFAULTS.primaryColor,
    };
    // Business-configured neutral surfaces are only designed for a light
    // background — reapplying them under dark mode stomps the dark palette's
    // own surfaces with light hex values (e.g. a white sidebar on an otherwise
    // dark screen), breaking contrast across the whole layout. Only the accent
    // color carries over into dark mode; sidebar/app background fall through
    // to the dark theme's own class-based defaults (.layout.theme-dark).
    if (this.mode() === 'light') {
      vars['--bg-sidebar'] = t.sidebarColor && validHex(t.sidebarColor) ? t.sidebarColor : DEFAULTS.sidebarColor;
      vars['--bg-app'] = t.backgroundColor && validHex(t.backgroundColor) ? t.backgroundColor : DEFAULTS.backgroundColor;
    }
    return vars;
  });

  /**
   * Single entry point: sets mode and business overrides together.
   * Call after /auth/me, or when the owner saves a new theme in settings.
   */
  applyAll(opts: { mode: 'light' | 'dark'; businessTheme?: BusinessThemeOverrides | null }): void {
    this.mode.set(opts.mode);
    this.businessTheme.set(
      opts.businessTheme && Object.keys(opts.businessTheme).length > 0 ? { ...opts.businessTheme } : null
    );
  }

  /** Prefer businessSettings.theme (DB), fallback to business.ui */
  static toBusinessThemeOverrides(
    businessUi?: BusinessUi | null,
    businessSettingsTheme?: BusinessSettingsTheme | null
  ): BusinessThemeOverrides | null {
    const fromSettings =
      businessSettingsTheme?.colors?.primary && validHex(businessSettingsTheme.colors.primary)
        ? {
            primaryColor: businessSettingsTheme.colors.primary,
            sidebarColor: businessSettingsTheme.colors.background && validHex(businessSettingsTheme.colors.background)
              ? businessSettingsTheme.colors.background
              : DEFAULTS.sidebarColor,
            backgroundColor:
              businessSettingsTheme.colors.background && validHex(businessSettingsTheme.colors.background)
                ? businessSettingsTheme.colors.background
                : DEFAULTS.backgroundColor,
          }
        : null;
    if (fromSettings) return fromSettings;
    if (businessUi?.primaryColor && validHex(businessUi.primaryColor)) {
      return {
        primaryColor: businessUi.primaryColor,
        sidebarColor: businessUi.sidebarColor && validHex(businessUi.sidebarColor) ? businessUi.sidebarColor : DEFAULTS.sidebarColor,
        backgroundColor: businessUi.backgroundColor && validHex(businessUi.backgroundColor) ? businessUi.backgroundColor : DEFAULTS.backgroundColor,
      };
    }
    return null;
  }

  /** Applied after a business owner saves their theme in settings. */
  applyBusinessUi(ui?: BusinessUi | null): void {
    const mode = ui?.themeMode === 'dark' ? 'dark' : this.mode();
    const businessTheme = ThemeService.toBusinessThemeOverrides(ui ?? null, null);
    this.applyAll({ mode, businessTheme: businessTheme ?? undefined });
  }

  /** Back to the permanent default (light, no business overrides) — e.g. right
   *  before exiting impersonation, so there's no visible flash of stale state
   *  while the follow-up /auth/me request is in flight. */
  reset(): void {
    this.applyAll({ mode: 'light', businessTheme: null });
  }
}
