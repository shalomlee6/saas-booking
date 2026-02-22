import type { IOpeningHours, IOpeningHoursRange } from '../models/BusinessSettings';
import { defaultOpeningHours } from '../models/BusinessSettings';

/** Minimal shape for a date override (supports lean docs) */
export interface AvailabilityOverrideForDate {
  type: 'closed' | 'custom';
  ranges?: Array<{ start: string; end: string }>;
}

/**
 * Get day-of-week (0 = Sunday, 6 = Saturday) from a YYYY-MM-DD date string.
 */
export function getDayOfWeekFromDateString(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.getDay();
}

/**
 * Given weekly openingHours and an optional override for a specific date,
 * returns the effective time ranges for that date.
 * Used by public availability endpoint to respect both default schedule and exceptions.
 *
 * @param dateStr - YYYY-MM-DD
 * @param openingHours - weekly schedule (uses default if null/undefined)
 * @param override - date-specific override if exists (e.g. closed or custom ranges)
 * @returns Array of { start: "HH:mm", end: "HH:mm" } for the given date
 */
export function applyOpeningHoursWithOverrides(
  dateStr: string,
  openingHours: IOpeningHours | null | undefined,
  override: AvailabilityOverrideForDate | null | undefined
): IOpeningHoursRange[] {
  const weekly = openingHours?.days?.length ? openingHours : defaultOpeningHours;
  const dayOfWeek = getDayOfWeekFromDateString(dateStr);

  if (override) {
    if (override.type === 'closed') {
      return [];
    }
    if (override.type === 'custom' && override.ranges?.length) {
      return override.ranges.map((r) => ({ start: r.start, end: r.end }));
    }
  }

  const dayConfig = weekly.days?.find((d) => d.day === dayOfWeek);
  if (!dayConfig || !dayConfig.isOpen || !dayConfig.ranges?.length) {
    return [];
  }
  return dayConfig.ranges.map((r) => ({ start: r.start, end: r.end }));
}
