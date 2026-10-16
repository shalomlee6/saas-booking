import { toDateKey } from '../../appointments/utils/calendar.utils';
import type { CreateAppointmentBody } from '../services/public-api.service';

export const DEFAULT_PUBLIC_TIMEZONE = 'Asia/Jerusalem';

/**
 * YYYY-MM-DD for `d` in the business IANA timezone (not the browser's local calendar).
 * Aligns with availability and server booking rules.
 */
export function toDateKeyInBusinessTimezone(d: Date, timeZone: string): string {
  return toDateKey(d, timeZone);
}

/**
 * A local Date whose calendar day is `now` in the business timezone.
 * Date pickers compare local year/month/day, so this is the earliest day they should allow.
 */
export function calendarDayInTimezone(now: Date, timeZone: string): Date {
  const key = toDateKey(now, timeZone || DEFAULT_PUBLIC_TIMEZONE);
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/** Whole days from today in `timeZone` until a `yyyy-mm-dd` visit date. */
export function daysUntilCalendarDate(dateKey: string, now: Date, timeZone: string): number | null {
  const parts = dateKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const todayKey = toDateKey(now, timeZone || DEFAULT_PUBLIC_TIMEZONE);
  const [todayYear, todayMonth, todayDay] = todayKey.split('-').map(Number);
  const [year, month, day] = parts;
  const todayMs = Date.UTC(todayYear ?? 1970, (todayMonth ?? 1) - 1, todayDay ?? 1);
  const targetMs = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  return Math.round((targetMs - todayMs) / 86_400_000);
}

/** `yyyy-mm-dd` of the calendar day a date picker selected. */
export function dateKeyFromPicker(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Builds public booking payload with current API contract.
 * Keeps date/time split unchanged; only centralizes mapping.
 */
export function buildPublicCreateAppointmentBody(args: {
  businessId: string;
  serviceId: string;
  date: string;
  time: string;
}): CreateAppointmentBody {
  return {
    businessId: args.businessId,
    serviceId: args.serviceId,
    date: args.date,
    time: args.time,
  };
}
