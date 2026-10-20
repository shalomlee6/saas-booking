import { ensureContrast, deriveFamily, fitSurface, mixHex, type ColorFamily } from './color-derive';
import { contrastRatio, failsContrast, onContrastColor } from './contrast-color';

export type ThemeMode = 'light' | 'dark';

/** The three colors an owner picks for a custom client-site theme. */
export interface CustomThemeColors {
  primary: string;
  secondary: string;
  background: string;
}

/** A theme's complete token set for one mode: page surfaces, text, borders and two color families. */
export interface DerivedTheme {
  primary: ColorFamily;
  secondary: ColorFamily;
  surfaces: {
    app: string;
    card: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textPlaceholder: string;
    border: string;
    borderStrong: string;
  };
}

const DARK_APP = '#0d0d0f';
const DARK_CARD = '#18181b';
const NEAR_BLACK_TEXT = '#111827';
const NEAR_WHITE_TEXT = '#f9fafb';

/** Page text for a background: the app's usual near-black / near-white when it clears 7:1, else the best of black/white. */
function pageText(background: string): string {
  const usual = (contrastRatio(NEAR_BLACK_TEXT, background) ?? 0) >= 7 ? NEAR_BLACK_TEXT : NEAR_WHITE_TEXT;
  return (contrastRatio(usual, background) ?? 0) >= 7 ? usual : onContrastColor(background);
}

function isLight(color: string): boolean {
  return (contrastRatio('#000000', color) ?? 0) > (contrastRatio('#ffffff', color) ?? 0);
}

function surfacesFor(app: string, card: string): DerivedTheme['surfaces'] {
  const textPrimary = ensureContrast(pageText(app), [app, card], 7);
  // Each step is mixed toward the page and then pushed back up to 4.5:1 on both surfaces.
  const soften = (amount: number) => ensureContrast(mixHex(textPrimary, app, amount), [app, card]);
  return {
    app,
    card,
    textPrimary,
    textSecondary: soften(0.2),
    textMuted: soften(0.38),
    textPlaceholder: soften(0.45),
    border: mixHex(app, textPrimary, 0.14),
    borderStrong: mixHex(app, textPrimary, 0.26),
  };
}

/**
 * Light or dark variant of a custom theme, derived from the owner's three colors.
 *
 * Light uses the chosen colors as they are; the page text, borders and cards follow from the background.
 * Dark keeps each color's hue but lifts it until it reads on a near-black page (tinted a little by the
 * chosen background), so a deep brand color is not lost in dark mode.
 *
 * Whatever the input, text-on-color, ink-on-tint and page text all reach WCAG 4.5:1 (see custom-theme.spec).
 */
export function deriveCustomTheme(colors: CustomThemeColors, mode: ThemeMode): DerivedTheme {
  if (mode === 'light') {
    const app = colors.background;
    // A light page gets a whiter card; a dark one (the owner chose a dark background) a slightly lighter one.
    const card = fitSurface(isLight(app) ? mixHex(app, '#ffffff', 0.7) : mixHex(app, '#ffffff', 0.08), pageText(app));
    const surfaces = surfacesFor(app, card);
    const text = surfaces.textPrimary;
    return {
      surfaces,
      primary: deriveFamily(colors.primary, { app, card }, 0.12, text),
      secondary: deriveFamily(colors.secondary, { app, card }, 0.14, text),
    };
  }
  const app = mixHex(DARK_APP, colors.background, 0.07);
  const card = fitSurface(mixHex(DARK_CARD, colors.background, 0.07), pageText(app));
  const surfaces = surfacesFor(app, card);
  const text = surfaces.textPrimary;
  const lift = (color: string) => ensureContrast(color, [app, card]);
  return {
    surfaces,
    primary: deriveFamily(lift(colors.primary), { app, card }, 0.18, text),
    secondary: deriveFamily(lift(colors.secondary), { app, card }, 0.2, text),
  };
}

/** CSS custom properties for a derived theme (the same names the public site's components already read). */
export function themeToVars(theme: DerivedTheme): Record<string, string> {
  const { primary, secondary, surfaces } = theme;
  return {
    '--color-primary': primary.base,
    '--color-primary-hover': primary.hover,
    '--color-primary-subtle': primary.subtle,
    '--color-primary-muted': primary.muted,
    '--color-primary-ink': primary.ink,
    '--on-primary': primary.on,
    '--color-secondary': secondary.base,
    '--color-secondary-hover': secondary.hover,
    '--color-secondary-subtle': secondary.subtle,
    '--color-secondary-ink': secondary.ink,
    '--on-secondary': secondary.on,
    '--bg-app': surfaces.app,
    '--bg-card': surfaces.card,
    '--bg-sidebar': surfaces.card,
    '--text-primary': surfaces.textPrimary,
    '--text-secondary': surfaces.textSecondary,
    '--text-muted': surfaces.textMuted,
    '--text-placeholder': surfaces.textPlaceholder,
    '--border-color': surfaces.border,
    '--border-color-strong': surfaces.borderStrong,
  };
}

/**
 * Whether a chosen color fails as TEXT on the page it sits on (light mode: the custom background). The
 * site stays readable regardless (it uses the derived ink for text), so this is advice to the owner: the
 * raw color is used for fills, borders and icons, where it will look faint.
 */
export function failsOnSurface(color: string, surface: string): boolean {
  return failsContrast(color, surface);
}
