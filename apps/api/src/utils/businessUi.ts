import { IBusinessUi } from '../models/Business';

const DEFAULT_UI: IBusinessUi = {
  themeMode: 'light',
  primaryColor: '#3787F6',
  sidebarColor: '#0F172A',
  backgroundColor: '#F6F8FB',
  logoUrl: '',
  dashboardLayout: 'classic',
};

export function normalizeBusinessUi(ui?: IBusinessUi | null): IBusinessUi {
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

export function validateBusinessUiBody(body: any): { valid: boolean; message?: string; ui?: Partial<IBusinessUi> } {
  const ui: Partial<IBusinessUi> = {};
  if (body.themeMode !== undefined) {
    if (body.themeMode !== 'light' && body.themeMode !== 'dark') {
      return { valid: false, message: 'themeMode must be "light" or "dark"' };
    }
    ui.themeMode = body.themeMode;
  }
  if (body.primaryColor !== undefined) {
    if (!isValidHex(body.primaryColor)) {
      return { valid: false, message: 'primaryColor must be a hex color (e.g. #3787F6)' };
    }
    ui.primaryColor = body.primaryColor;
  }
  if (body.sidebarColor !== undefined) {
    if (!isValidHex(body.sidebarColor)) {
      return { valid: false, message: 'sidebarColor must be a hex color' };
    }
    ui.sidebarColor = body.sidebarColor;
  }
  if (body.backgroundColor !== undefined) {
    if (body.backgroundColor !== '' && !isValidHex(body.backgroundColor)) {
      return { valid: false, message: 'backgroundColor must be a hex color or empty' };
    }
    ui.backgroundColor = body.backgroundColor;
  }
  if (body.logoUrl !== undefined) {
    ui.logoUrl = typeof body.logoUrl === 'string' ? body.logoUrl : '';
  }
  if (body.dashboardLayout !== undefined) {
    if (body.dashboardLayout !== 'classic' && body.dashboardLayout !== 'compact') {
      return { valid: false, message: 'dashboardLayout must be "classic" or "compact"' };
    }
    ui.dashboardLayout = body.dashboardLayout;
  }
  return { valid: true, ui };
}
