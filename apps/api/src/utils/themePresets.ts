/**
 * Valid public-site theme preset ids — must stay in sync with the frontend's
 * own registry (`apps/frontend-web/src/app/core/theming/theme-presets.ts`).
 * The two apps don't share code, so this list is duplicated deliberately;
 * adding a preset already requires a frontend change, so add it here too.
 */
export const VALID_THEME_PRESET_IDS = ['prime-pink', 'prime-mint'] as const;

export function isValidThemePresetId(id: string): boolean {
  return (VALID_THEME_PRESET_IDS as readonly string[]).includes(id);
}
