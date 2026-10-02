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

/**
 * Mixes a hex color toward white (`amount` > 0) or black (`amount` < 0) by a
 * fraction in [-1, 1] — a simple RGB lerp, not perceptual, but good enough for
 * deriving a UI tint/shade from an arbitrary business accent color. Used so a
 * business's custom `--color-primary` gets a matching `-hover`/`-subtle`/
 * `-muted`/`-ink` family instead of those four staying pinned to the CSS
 * defaults' own hue — which otherwise reads as two unrelated colors clashing
 * (e.g. a pink button next to indigo-tinted icons) whenever a business's
 * accent differs from the platform default.
 */
function mix(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const target = amount >= 0 ? 255 : 0;
  const f = Math.abs(amount);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const mixed = [r, g, b].map((c) => clamp(c + (target - c) * f));
  return '#' + mixed.map((c) => c.toString(16).padStart(2, '0')).join('');
}

const DEFAULTS = {
  primaryColor: '#4F46E5',
  sidebarColor: '#0F172A',
  backgroundColor: '#F5F7FB',
};

/**
 * Business owner dashboard theme (light/dark + a business's own accent color).
 * Purely reactive — holds state as signals that `LayoutComponent`'s template
 * binds onto its own `.layout` root ([class.theme-dark] / [ngStyle]), instead
 * of this service reaching into the DOM itself. This is what keeps the theme
 * scoped to the dashboard shell: no business's colors or light/dark mode are
 * ever written anywhere but `.layout`'s own bindings, so there is no global
 * state for a business's theme (or impersonation) to leak into the
 * super-admin panel, which never binds to these signals at all and is
 * permanently styled by the `:root` defaults in styles.scss.
 *
 * PrimeNG's own overlay components (select/datepicker panels, dialogs,
 * drawers, toasts) portal to `<body>`, outside `.layout` — matching them to
 * the current mode needs a body-level class, but that's deliberately NOT done
 * here: a singleton service's effect has no way to know when `.layout` itself
 * has been unmounted (e.g. navigating to the super-admin panel or the public
 * site), so it would leave a stale class behind. `LayoutComponent` owns that
 * instead, via an effect scoped to its own lifecycle — see its constructor.
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
    const primary = t.primaryColor && validHex(t.primaryColor) ? t.primaryColor : DEFAULTS.primaryColor;
    const dark = this.mode() === 'dark';
    // Derive the rest of the primary family from whichever color actually won
    // above (the business's own, or the platform default) so every token
    // stays the same hue — see `mix()`'s doc comment for why this matters.
    const vars: Record<string, string> = {
      '--color-primary': primary,
      '--color-primary-hover': mix(primary, dark ? 0.25 : -0.12),
      '--color-primary-subtle': mix(primary, dark ? -0.75 : 0.92),
      '--color-primary-muted': mix(primary, dark ? -0.4 : 0.68),
      '--color-primary-ink': mix(primary, dark ? 0.7 : -0.35),
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

  /**
   * Sourced only from `business.ui.*` — the dashboard's OWN admin-facing
   * theme fields (editable in Settings > Theme). This deliberately does not
   * consider `businessSettings.theme` (the customer-facing public booking
   * site's own brand colors, edited in Settings > Landing/Design): those are
   * a different surface for a different audience, and folding a tenant's
   * public brand into their own internal admin tool meant the platform's own
   * indigo-teal dashboard identity was invisible for any business that had
   * customized their public site — which is most of them.
   */
  static toBusinessThemeOverrides(businessUi?: BusinessUi | null): BusinessThemeOverrides | null {
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
    const businessTheme = ThemeService.toBusinessThemeOverrides(ui ?? null);
    this.applyAll({ mode, businessTheme: businessTheme ?? undefined });
  }

  /** Back to the permanent default (light, no business overrides) — e.g. right
   *  before exiting impersonation, so there's no visible flash of stale state
   *  while the follow-up /auth/me request is in flight. */
  reset(): void {
    this.applyAll({ mode: 'light', businessTheme: null });
  }
}
