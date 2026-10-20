/**
 * The server's business-settings defaults (apps/api/src/config/businessSettingsDefaults.ts), as delivered
 * in the `/auth/me` payload. The app reads its fallbacks and placeholders from this instead of keeping
 * its own copy, so a default changes in exactly one place.
 */
export interface SettingsDefaults {
  ui: {
    themeMode: 'light' | 'dark';
    primaryColor: string;
    sidebarColor: string;
    backgroundColor: string;
    logoUrl: string;
    dashboardLayout: 'classic' | 'compact';
  };
  theme: {
    colors: { primary: string; secondary: string; accent: string; background: string; text: string };
    preset: string;
    defaultMode: 'light' | 'dark';
  };
  onlineBooking: {
    enabled: boolean;
    minLeadMinutes: number;
    maxAdvanceDays: number;
    bufferMinutes: number;
    onlineDefaultStatus: 'confirmed' | 'pending';
    maxActiveAppointmentsPerClient: number | null;
    clientCanCancelOnline: boolean;
  };
  cancellationWindowHours: number;
  noShowPolicy: { enabled: boolean; threshold: number };
  reliability: {
    lateCancellation: { enabled: boolean; threshold: number };
    lateArrival: { enabled: boolean; threshold: number };
    lookback: '12months' | 'all';
  };
  birthdayField: 'required' | 'optional' | 'hidden';
}
