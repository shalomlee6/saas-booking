import { DateTime } from 'luxon';

export const DEFAULT_BUSINESS_TIMEZONE = 'Asia/Jerusalem';

export const DATE_RANGE_PRESETS = [
  'today',
  'last7Days',
  'last30Days',
  'thisMonth',
  'previousMonth',
  'custom',
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

/** Inclusive `start`, exclusive `end`. */
export interface HalfOpenInstantRange {
  start: Date;
  end: Date;
}

export interface ResolveDateRangeInput {
  preset: DateRangePreset;
  /** IANA zone. Blank falls back to Asia/Jerusalem. */
  timezone?: string;
  /** Instant used as "now". Defaults to the current time. */
  now?: Date;
  /**
   * Custom preset only. `from` is the inclusive calendar day and `to` is the
   * exclusive calendar day, both YYYY-MM-DD in `timezone`.
   */
  from?: string;
  to?: string;
}

function zoneOrDefault(timezone: string | undefined): string {
  const zone = timezone?.trim() || DEFAULT_BUSINESS_TIMEZONE;
  return zone;
}

function zonedNow(now: Date | undefined, zone: string): DateTime {
  const value = DateTime.fromJSDate(now ?? new Date(), { zone });
  if (!value.isValid) {
    throw new Error(`Invalid timezone "${zone}"`);
  }
  return value;
}

function calendarDay(isoDate: string, zone: string): DateTime {
  const value = DateTime.fromISO(isoDate, { zone }).startOf('day');
  if (!value.isValid) {
    throw new Error(`Invalid calendar date "${isoDate}"`);
  }
  return value;
}

/** Start of a YYYY-MM-DD calendar day in the business timezone. */
export function startOfBusinessDay(isoDate: string, timezone?: string): Date {
  return calendarDay(isoDate, zoneOrDefault(timezone)).toJSDate();
}

/**
 * Calendar ranges in the business timezone. "Last 7/30 days" includes today
 * and counts calendar days, not rolling 24-hour windows.
 * - today: [start of today, start of tomorrow)
 * - last7Days: [start of today-6 days, start of tomorrow)
 * - last30Days: [start of today-29 days, start of tomorrow)
 * - thisMonth: [start of this month, start of next month)
 * - previousMonth: [start of previous month, start of this month)
 * - custom: [start of `from`, start of `to`)
 */
export function resolveDateRange(input: ResolveDateRangeInput): HalfOpenInstantRange {
  const zone = zoneOrDefault(input.timezone);
  const now = zonedNow(input.now, zone);
  const startOfToday = now.startOf('day');
  const startOfTomorrow = startOfToday.plus({ days: 1 });

  switch (input.preset) {
    case 'today':
      return { start: startOfToday.toJSDate(), end: startOfTomorrow.toJSDate() };
    case 'last7Days':
      return {
        start: startOfToday.minus({ days: 6 }).toJSDate(),
        end: startOfTomorrow.toJSDate(),
      };
    case 'last30Days':
      return {
        start: startOfToday.minus({ days: 29 }).toJSDate(),
        end: startOfTomorrow.toJSDate(),
      };
    case 'thisMonth': {
      const start = now.startOf('month');
      return { start: start.toJSDate(), end: start.plus({ months: 1 }).toJSDate() };
    }
    case 'previousMonth': {
      const startOfThisMonth = now.startOf('month');
      return {
        start: startOfThisMonth.minus({ months: 1 }).toJSDate(),
        end: startOfThisMonth.toJSDate(),
      };
    }
    case 'custom': {
      if (!input.from || !input.to) {
        throw new Error('Custom range requires from and to');
      }
      const start = calendarDay(input.from, zone);
      const end = calendarDay(input.to, zone);
      if (start.toMillis() >= end.toMillis()) {
        throw new Error('Custom range must be half-open [from, to)');
      }
      return { start: start.toJSDate(), end: end.toJSDate() };
    }
    default: {
      const neverPreset: never = input.preset;
      throw new Error(`Unknown date range preset "${String(neverPreset)}"`);
    }
  }
}
