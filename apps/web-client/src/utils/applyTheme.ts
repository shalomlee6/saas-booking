import type { BusinessSettingsDto, ThemeDto } from '../types/api-types';

export function applyTheme(settings: BusinessSettingsDto | { theme: ThemeDto }): void {
  const theme = 'theme' in settings ? settings.theme : (settings as BusinessSettingsDto).theme;

  if (!theme || !theme.colors) {
    return;
  }

  const root = document.documentElement;

  // Map theme colors to CSS variables
  // Primary color
  root.style.setProperty('--primary', theme.colors.primary);
  root.style.setProperty('--pink-500', theme.colors.primary); // Keep existing naming for compatibility

  // Secondary color
  root.style.setProperty('--pink-100', theme.colors.secondary);
  root.style.setProperty('--secondary', theme.colors.secondary);

  // Accent color
  root.style.setProperty('--mint-400', theme.colors.accent);
  root.style.setProperty('--accent', theme.colors.accent);

  // Background
  root.style.setProperty('--bg-page', theme.colors.background);
  root.style.setProperty('--bg', theme.colors.background);
  root.style.setProperty('--surface', theme.colors.background);

  // Text
  root.style.setProperty('--text', theme.colors.text);

  // Font family
  if (theme.fontFamily) {
    document.body.style.fontFamily = theme.fontFamily;
  }
}

