import { deriveFamily, ensureContrast } from './color-derive';
import { onContrastColor } from './contrast-color';
import { deriveCustomTheme, themeToVars, type CustomThemeColors, type ThemeMode } from './custom-theme';
import { resolveThemePreset, type ThemeFamily } from './theme-presets';

export type { ThemeMode } from './custom-theme';

/** The preset id that means "use the business's own three colors". */
export const CUSTOM_THEME_PRESET_ID = 'custom';

/** The slice of a business's stored public theme that decides how the site looks. */
export interface PublicThemeInput {
  preset?: string | null;
  colors?: Partial<CustomThemeColors> | null;
}

const TOKEN_MAP: Record<Exclude<keyof ThemeFamily, 'secondary'>, string> = {
  primary: '--color-primary',
  primaryHover: '--color-primary-hover',
  primarySubtle: '--color-primary-subtle',
  primaryMuted: '--color-primary-muted',
  primaryInk: '--color-primary-ink',
  onPrimary: '--on-primary',
};

const INTRO_STAGE_BG_TOKEN = '--intro-stage-bg';

/** Dark "stage" backdrop shown behind the landing-page entrance animation
 *  (before the hero/content have slid into place) — depends only on the
 *  tenant's own light/dark mode, not the color preset, and is the inverse of
 *  that mode's normal page background so the reveal always reads as a
 *  deliberate contrast rather than a same-color flash. */
const INTRO_STAGE_BG: Record<ThemeMode, string> = {
  light: '#111827',
  dark: '#f5f5f7',
};

/** The page surfaces a preset's secondary color is derived against (the site's built-in chrome, see styles.scss). */
const PRESET_SURFACES: Record<ThemeMode, { app: string; card: string }> = {
  light: { app: '#f5f5f7', card: '#ffffff' },
  dark: { app: '#0d0d0f', card: '#18181b' },
};

/** The page text color of those built-in surfaces. */
const PRESET_PAGE_TEXT: Record<ThemeMode, string> = { light: '#111827', dark: '#f9fafb' };

const HEX = /^#[0-9a-fA-F]{6}$/;

function customColors(theme: PublicThemeInput | null | undefined): CustomThemeColors | null {
  const colors = theme?.colors;
  if (theme?.preset !== CUSTOM_THEME_PRESET_ID || !colors) return null;
  const { primary, secondary, background } = colors;
  if (!primary || !secondary || !background) return null;
  if (![primary, secondary, background].every((color) => HEX.test(color))) return null;
  return { primary, secondary, background };
}

/**
 * business public theme → CSS custom-property overrides for a given light/dark mode.
 *
 * A preset gives hand-tuned primary tokens (plus a derived secondary); "custom" derives every token —
 * surfaces, text, both color families, light and dark — from the owner's three colors. Single source of
 * truth for resolving a tenant's public-facing colors: the public site itself (PublicLayoutComponent),
 * the landing page editor's live preview and the client-site theme preview all call this, so none of
 * them can drift from what a visitor actually sees.
 */
export function resolvePublicThemeVars(
  theme: PublicThemeInput | null | undefined,
  mode: ThemeMode
): Record<string, string> {
  const custom = customColors(theme);
  if (custom) {
    return { ...themeToVars(deriveCustomTheme(custom, mode)), [INTRO_STAGE_BG_TOKEN]: INTRO_STAGE_BG[mode] };
  }

  const family = resolveThemePreset(theme?.preset)[mode];
  const surfaces = PRESET_SURFACES[mode];
  const vars: Record<string, string> = {};
  for (const key of Object.keys(TOKEN_MAP) as (keyof typeof TOKEN_MAP)[]) {
    vars[TOKEN_MAP[key]] = key === 'onPrimary' ? onContrastColor(family.primary) : family[key];
  }
  const secondarySeed = mode === 'dark' ? ensureContrast(family.secondary, [surfaces.app, surfaces.card]) : family.secondary;
  const secondary = deriveFamily(secondarySeed, surfaces, mode === 'dark' ? 0.2 : 0.14, PRESET_PAGE_TEXT[mode]);
  vars['--color-secondary'] = secondary.base;
  vars['--color-secondary-hover'] = secondary.hover;
  vars['--color-secondary-subtle'] = secondary.subtle;
  vars['--color-secondary-ink'] = secondary.ink;
  vars['--on-secondary'] = secondary.on;
  vars[INTRO_STAGE_BG_TOKEN] = INTRO_STAGE_BG[mode];
  return vars;
}
