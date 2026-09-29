/**
 * Central registry of public tenant site theme presets. Each preset is a
 * complete light + dark token family; a business references a preset by id
 * (persisted on `BusinessSettings.theme.preset`) instead of storing its own
 * colors. Adding a new preset later is just adding an entry here.
 */
export interface ThemeFamily {
  primary: string;
  primaryHover: string;
  primarySubtle: string;
  primaryMuted: string;
  primaryInk: string;
  /** Text/icon color for content sitting ON a solid `primary`/`primaryHover` fill. */
  onPrimary: string;
}

export interface ThemePreset {
  id: string;
  label: string;
  light: ThemeFamily;
  dark: ThemeFamily;
}

export const DEFAULT_THEME_PRESET_ID = 'prime-pink';

export const THEME_PRESETS: Record<string, ThemePreset> = {
  'prime-pink': {
    id: 'prime-pink',
    label: 'Prime Pink',
    light: {
      primary: '#F35271',
      primaryHover: '#de3b5c',
      primarySubtle: '#fef1f4',
      primaryMuted: '#fbc7d3',
      primaryInk: '#96263d',
      onPrimary: '#ffffff',
    },
    dark: {
      primary: '#f06b8a',
      primaryHover: '#f8849f',
      primarySubtle: '#2a1520',
      primaryMuted: '#4a2030',
      primaryInk: '#f8849f',
      // Dark mode's primary is deliberately lighter/brighter (so it pops on
      // black) — too light for white text (2.8:1). Dark text is correct here.
      onPrimary: '#0d0d0f',
    },
  },
  'prime-mint': {
    id: 'prime-mint',
    label: 'Prime Mint',
    light: {
      primary: '#A8C5B0',
      primaryHover: '#8FB29B',
      primarySubtle: '#EFF5F1',
      primaryMuted: '#D3E5DA',
      primaryInk: '#3F5E4C',
      // Mint is too light for white button text (1.9:1) — use dark ink instead.
      onPrimary: '#111827',
    },
    dark: {
      primary: '#A8C5B0',
      primaryHover: '#C0DBC9',
      primarySubtle: '#16211C',
      primaryMuted: '#223B2E',
      primaryInk: '#C0DBC9',
      onPrimary: '#0d0d0f',
    },
  },
};

export const THEME_PRESET_LIST: ThemePreset[] = Object.values(THEME_PRESETS);

/** Resolves a preset id to its preset, falling back to the default when unset or unknown. */
export function resolveThemePreset(id?: string | null): ThemePreset {
  return (id && THEME_PRESETS[id]) || THEME_PRESETS[DEFAULT_THEME_PRESET_ID];
}
