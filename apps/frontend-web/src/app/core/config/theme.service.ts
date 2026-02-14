import { Injectable, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

const STORAGE_KEY = 'sb_theme';

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
  primaryColor: '#3787F6',
  sidebarColor: '#0F172A',
  backgroundColor: '#F6F8FB',
};

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);

  readonly currentMode = signal<'light' | 'dark'>('light');
  /** Stored so toggle can re-apply with same overrides */
  private lastBusinessTheme: BusinessThemeOverrides | null = null;

  /**
   * Applies only base light/dark mode (body class). Does not set primary/sidebar.
   * Base tones come from .theme-light / .theme-dark in styles.scss.
   */
  applyMode(mode: 'light' | 'dark'): void {
    const root = this.doc.body;
    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(mode === 'dark' ? 'theme-dark' : 'theme-light');
    this.currentMode.set(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {}
  }

  /**
   * Applies only business overrides (--color-primary, --bg-sidebar, --bg-app).
   * Does not change light/dark mode.
   */
  applyBusinessTheme(theme: BusinessThemeOverrides | null | undefined): void {
    this.lastBusinessTheme = theme && Object.keys(theme).length > 0 ? { ...theme } : null;
    const root = this.doc.body;

    const primary = theme?.primaryColor && validHex(theme.primaryColor)
      ? theme.primaryColor
      : DEFAULTS.primaryColor;
    const sidebar = theme?.sidebarColor && validHex(theme.sidebarColor)
      ? theme.sidebarColor
      : DEFAULTS.sidebarColor;
    const bg = theme?.backgroundColor && validHex(theme.backgroundColor)
      ? theme.backgroundColor
      : DEFAULTS.backgroundColor;

    root.style.setProperty('--color-primary', primary);
    root.style.setProperty('--bg-sidebar', sidebar);
    root.style.setProperty('--bg-app', bg);
  }

  /**
   * Single entry point: clear previous overrides, then set base mode and business overrides.
   * Call after /auth/me or when toggling mode.
   */
  applyAll(opts: {
    mode: 'light' | 'dark';
    businessTheme?: BusinessThemeOverrides | null;
  }): void {
    const root = this.doc.body;
    root.style.removeProperty('--color-primary');
    root.style.removeProperty('--bg-sidebar');
    root.style.removeProperty('--bg-app');
    root.classList.remove('theme-light', 'theme-dark');

    root.classList.add(opts.mode === 'dark' ? 'theme-dark' : 'theme-light');
    this.currentMode.set(opts.mode);
    try {
      localStorage.setItem(STORAGE_KEY, opts.mode);
    } catch {}

    this.lastBusinessTheme =
      opts.businessTheme && Object.keys(opts.businessTheme).length > 0
        ? { ...opts.businessTheme }
        : null;
    if (this.lastBusinessTheme) {
      const t = this.lastBusinessTheme;
      root.style.setProperty(
        '--color-primary',
        t.primaryColor && validHex(t.primaryColor) ? t.primaryColor : DEFAULTS.primaryColor
      );
      root.style.setProperty(
        '--bg-sidebar',
        t.sidebarColor && validHex(t.sidebarColor) ? t.sidebarColor : DEFAULTS.sidebarColor
      );
      root.style.setProperty(
        '--bg-app',
        t.backgroundColor && validHex(t.backgroundColor) ? t.backgroundColor : DEFAULTS.backgroundColor
      );
    }
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

  getLastBusinessTheme(): BusinessThemeOverrides | null {
    return this.lastBusinessTheme ? { ...this.lastBusinessTheme } : null;
  }

  /** For layout toggle: re-apply with new mode and same business overrides. */
  setModeAndReapply(mode: 'light' | 'dark'): void {
    this.applyAll({ mode, businessTheme: this.lastBusinessTheme ?? undefined });
  }

  /** Backward compatibility: apply business.ui from dashboard/settings (single source: still goes through applyAll). */
  applyBusinessUi(ui?: BusinessUi | null): void {
    const mode = ui?.themeMode === 'dark' ? 'dark' : this.currentMode();
    const businessTheme = ThemeService.toBusinessThemeOverrides(ui ?? null, null);
    this.applyAll({ mode, businessTheme: businessTheme ?? undefined });
  }
}
