import { IBusinessUi } from '../models/Business';
import { BUSINESS_SETTINGS_DEFAULTS } from '../config/businessSettingsDefaults';

const DEFAULT_UI: IBusinessUi = BUSINESS_SETTINGS_DEFAULTS.ui;

export function normalizeBusinessUi(ui?: Partial<IBusinessUi> | null): IBusinessUi {
  if (!ui || typeof ui !== 'object') {
    return { ...DEFAULT_UI };
  }
  return {
    themeMode: ui.themeMode === 'dark' ? 'dark' : 'light',
    primaryColor: typeof ui.primaryColor === 'string' ? ui.primaryColor : DEFAULT_UI.primaryColor,
    sidebarColor: typeof ui.sidebarColor === 'string' ? ui.sidebarColor : DEFAULT_UI.sidebarColor,
    backgroundColor: typeof ui.backgroundColor === 'string' ? ui.backgroundColor : DEFAULT_UI.backgroundColor,
    logoUrl: typeof ui.logoUrl === 'string' ? ui.logoUrl : DEFAULT_UI.logoUrl,
    dashboardLayout: ui.dashboardLayout === 'compact' ? 'compact' : 'classic',
  };
}

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function isValidHex(color: string): boolean {
  return typeof color === 'string' && HEX_REGEX.test(color);
}

export function validateBusinessUiBody(body: Record<string, unknown>): {
  valid: boolean;
  message?: string;
  ui?: Partial<IBusinessUi>;
} {
  const ui: Partial<IBusinessUi> = {};
  const themeMode = body['themeMode'];
  if (themeMode === 'light' || themeMode === 'dark') {
    ui.themeMode = themeMode;
  } else if (themeMode !== undefined) {
    return { valid: false, message: 'themeMode must be "light" or "dark"' };
  }
  const primaryColor = body['primaryColor'];
  if (primaryColor !== undefined) {
    if (typeof primaryColor !== 'string' || !isValidHex(primaryColor)) {
      return { valid: false, message: 'primaryColor must be a hex color (e.g. #3787F6)' };
    }
    ui.primaryColor = primaryColor;
  }
  const sidebarColor = body['sidebarColor'];
  if (sidebarColor !== undefined) {
    if (typeof sidebarColor !== 'string' || !isValidHex(sidebarColor)) {
      return { valid: false, message: 'sidebarColor must be a hex color' };
    }
    ui.sidebarColor = sidebarColor;
  }
  const backgroundColor = body['backgroundColor'];
  if (backgroundColor !== undefined) {
    if (
      typeof backgroundColor !== 'string' ||
      (backgroundColor !== '' && !isValidHex(backgroundColor))
    ) {
      return { valid: false, message: 'backgroundColor must be a hex color or empty' };
    }
    ui.backgroundColor = backgroundColor;
  }
  const logoUrl = body['logoUrl'];
  if (logoUrl !== undefined) {
    ui.logoUrl = typeof logoUrl === 'string' ? logoUrl : '';
  }
  const dashboardLayout = body['dashboardLayout'];
  if (dashboardLayout === 'classic' || dashboardLayout === 'compact') {
    ui.dashboardLayout = dashboardLayout;
  } else if (dashboardLayout !== undefined) {
    return { valid: false, message: 'dashboardLayout must be "classic" or "compact"' };
  }
  return { valid: true, ui };
}
