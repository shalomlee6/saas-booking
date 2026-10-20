import type { IBusinessSettings } from '../models/BusinessSettings';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import type { PublicThemeBody } from '../validation/schemas/businessSettings';

/** The public client-site theme: the single stored object the site, the owner and the super-admin all use. */
export interface PublicTheme {
  preset: string;
  defaultMode: 'light' | 'dark';
  /** Used only while `preset` is "custom". */
  colors: { primary: string; secondary: string; background: string };
}

export function readPublicTheme(settings: Pick<IBusinessSettings, 'theme'>): PublicTheme {
  const theme = settings.theme;
  return {
    preset: theme.preset ?? 'prime-pink',
    defaultMode: theme.defaultMode ?? 'light',
    colors: {
      primary: theme.colors.primary,
      secondary: theme.colors.secondary,
      background: theme.colors.background,
    },
  };
}

export async function savePublicTheme(
  businessId: string,
  patch: PublicThemeBody
): Promise<{ changed: boolean; previous: PublicTheme; current: PublicTheme; settingsId: string }> {
  const settings = await ensureBusinessSettings(businessId);
  const previous = readPublicTheme(settings);
  if (patch.preset !== undefined) settings.theme.preset = patch.preset;
  if (patch.defaultMode !== undefined) settings.theme.defaultMode = patch.defaultMode;
  for (const key of ['primary', 'secondary', 'background'] as const) {
    const value = patch.colors?.[key];
    if (value !== undefined) settings.theme.colors[key] = value.toUpperCase();
  }
  const current = readPublicTheme(settings);
  const changed = JSON.stringify(previous) !== JSON.stringify(current);
  if (changed) await settings.save();
  return { changed, previous, current, settingsId: settings._id.toString() };
}
