import { z } from 'zod';

/** Stored appointment lifecycle (API + DB). */
export const APPOINTMENT_STATUSES = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export const appointmentStatusZod = z.enum(APPOINTMENT_STATUSES);

/** How the booking was created. */
export const APPOINTMENT_SOURCES = ['owner', 'client-online'] as const;
export type AppointmentSource = (typeof APPOINTMENT_SOURCES)[number];
export const appointmentSourceZod = z.enum(APPOINTMENT_SOURCES);

/** Subscription / plan tier in business settings. `normal` is legacy; prefer `pro`. */
export const SETTINGS_PLANS = ['free', 'normal', 'pro', 'premium'] as const;
export type SettingsPlan = (typeof SETTINGS_PLANS)[number];
export const settingsPlanZod = z.enum(SETTINGS_PLANS);

/** UI / settings language codes we persist. */
export const SETTINGS_LANGUAGES = ['he', 'en'] as const;
export type SettingsLanguage = (typeof SETTINGS_LANGUAGES)[number];
export const settingsLanguageZod = z.enum(SETTINGS_LANGUAGES);

/** Date-specific availability override shape. */
export const AVAILABILITY_OVERRIDE_TYPES = ['closed', 'custom'] as const;
export type AvailabilityOverrideType = (typeof AVAILABILITY_OVERRIDE_TYPES)[number];
export const availabilityOverrideTypeZod = z.enum(AVAILABILITY_OVERRIDE_TYPES);
