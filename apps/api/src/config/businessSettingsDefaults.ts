import type { SettingsPlan } from '../dto/enums';

/**
 * The one place that says what every business setting is out of the box.
 * The Mongoose schemas, the value resolvers (older documents with missing fields) and
 * factory reset all read from here. Do not repeat these values anywhere else.
 */

type Day = { day: number; isOpen: boolean; ranges: { start: string; end: string }[] };

function openingDay(day: number, isOpen: boolean, end?: string): Day {
  return { day, isOpen, ranges: isOpen && end ? [{ start: '08:00', end }] : [] };
}

export const BUSINESS_SETTINGS_DEFAULTS = {
  plan: 'free' as SettingsPlan,

  /** Admin portal look. Lives on `Business.ui`. */
  ui: {
    themeMode: 'light' as 'light' | 'dark',
    primaryColor: '#3787F6',
    sidebarColor: '#0F172A',
    backgroundColor: '#F6F8FB',
    logoUrl: '',
    dashboardLayout: 'classic' as 'classic' | 'compact',
  },

  /** Public site look. Lives on `BusinessSettings.theme`. */
  theme: {
    colors: {
      primary: '#F35271',
      secondary: '#FF9DBC',
      accent: '#6CD6CD',
      background: '#FFFFFF',
      text: '#111827',
    },
    preset: 'prime-pink',
    defaultMode: 'light' as 'light' | 'dark',
    logoUrl: null as string | null,
    fontFamily: 'system-ui',
  },

  /** Plan entitlements (set at provisioning from the plan). */
  features: {
    bookingEnabled: true,
    paymentsEnabled: false,
    marketingModule: false,
    chatModule: false,
    waitlistEnabled: false,
    analyticsEnabled: false,
    customDomainEnabled: false,
  },

  /** Online booking rules. `cancellationWindowHours` is stored beside the block, not inside it. */
  onlineBooking: {
    enabled: true,
    minLeadMinutes: 60,
    maxAdvanceDays: 60,
    bufferMinutes: 0,
    onlineDefaultStatus: 'confirmed' as 'confirmed' | 'pending',
    maxActiveAppointmentsPerClient: null as number | null,
    clientCanCancelOnline: true,
  },
  cancellationWindowHours: 24,

  /** Reliability. No-show has its own block for historical reasons. */
  noShowPolicy: { enabled: true, threshold: 3 },
  reliability: {
    lateCancellation: { enabled: false, threshold: 3 },
    lateArrival: { enabled: false, threshold: 3 },
    lookback: '12months' as '12months' | 'all',
  },

  birthdayField: 'required' as 'required' | 'optional' | 'hidden',

  localization: {
    language: 'he' as 'he' | 'en',
    timezone: 'Asia/Jerusalem',
    currency: 'ILS',
  },

  /** Sun–Thu 08:00–18:00, Fri 08:00–14:00, Sat closed. */
  openingHours: {
    slotStepMinutes: 30,
    days: [
      openingDay(0, true, '18:00'),
      openingDay(1, true, '18:00'),
      openingDay(2, true, '18:00'),
      openingDay(3, true, '18:00'),
      openingDay(4, true, '18:00'),
      openingDay(5, true, '14:00'),
      openingDay(6, false),
    ],
  },

  /** Public landing page content. */
  landing: {
    bookingWelcomeMessage: '',
    tagline: '',
    coverImageUrl: '',
    secondaryHeroImageUrl: '',
    heroDescription: '',
    contact: { whatsapp: '', email: '', location: '' },
    publicRating: 5,
    businessPhonePublic: '',
  },
};

export type BusinessSettingsDefaults = typeof BUSINESS_SETTINGS_DEFAULTS;
