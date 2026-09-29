import { resolveThemePreset, type ThemeFamily } from './theme-presets';

export type ThemeMode = 'light' | 'dark';

const TOKEN_MAP: Record<keyof ThemeFamily, string> = {
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

/**
 * business → CSS custom-property overrides for a given light/dark mode, from
 * its configured theme preset. Single source of truth for resolving a
 * tenant's public-facing colors — used by the public site itself
 * (PublicLayoutComponent), the landing page editor's live preview, and any
 * other preview surface, so they can never drift out of sync with each other
 * or fall back to reading an old/unmigrated theme field directly.
 */
export function resolveBusinessThemeVars(
  presetId: string | null | undefined,
  mode: ThemeMode
): Record<string, string> {
  const preset = resolveThemePreset(presetId);
  const family = preset[mode];
  const vars: Record<string, string> = {};
  for (const key of Object.keys(TOKEN_MAP) as (keyof ThemeFamily)[]) {
    vars[TOKEN_MAP[key]] = family[key];
  }
  vars[INTRO_STAGE_BG_TOKEN] = INTRO_STAGE_BG[mode];
  return vars;
}
