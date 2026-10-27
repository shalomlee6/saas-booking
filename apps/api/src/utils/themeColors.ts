/**
 * The stored theme colors a client may see: primary, secondary and background.
 * Settings written before `accent` and `text` were removed still carry them in MongoDB; reads pick the
 * known keys, so those leftovers never reach a response (and so can never be sent back in a save).
 */
export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
}

export function pickThemeColors(colors: Partial<ThemeColors> | null | undefined): ThemeColors {
  return {
    primary: colors?.primary as string,
    secondary: colors?.secondary as string,
    background: colors?.background as string,
  };
}

/** `colors` of a theme object with the legacy keys left out; everything else is passed through. */
export function withKnownThemeColors<T extends { colors?: Partial<ThemeColors> | null }>(theme: T): T {
  if (!theme || !theme.colors) return theme;
  return { ...theme, colors: pickThemeColors(theme.colors) };
}
