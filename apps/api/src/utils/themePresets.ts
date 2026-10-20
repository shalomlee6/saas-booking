/**
 * Valid public-site theme preset ids. `prime-pink` and `prime-mint` must stay in sync with the
 * frontend's own registry (`apps/frontend-web/src/app/core/theming/theme-presets.ts`); the two apps
 * don't share code, so adding a preset needs a change on both sides.
 *
 * `custom` is not a registry entry: the site is then themed from the business's own three colors
 * (`theme.colors.primary`, `.secondary`, `.background`), with everything else derived from them.
 */
export const CUSTOM_THEME_PRESET_ID = 'custom';
export const VALID_THEME_PRESET_IDS = ['prime-pink', 'prime-mint', CUSTOM_THEME_PRESET_ID] as const;

export function isValidThemePresetId(id: string): boolean {
  return (VALID_THEME_PRESET_IDS as readonly string[]).includes(id);
}
