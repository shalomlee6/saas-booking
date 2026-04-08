import { z } from 'zod';
import { isValidIso8601InstantWithOffset, isValidYyyyMmDd } from './strictCalendar';

/** MongoDB ObjectId as 24 hex chars (string form). */
export const mongoObjectIdString = z
  .string()
  .length(24)
  .regex(/^[a-fA-F0-9]{24}$/, 'Must be a 24-character hexadecimal ObjectId');

/**
 * ISO 8601 datetime with explicit UTC (`Z`) or numeric offset.
 * Rejects invalid calendar instants (Luxon); does not use Date.parse normalization slop.
 */
export const iso8601DateTimeWithOffset = z.string().refine(isValidIso8601InstantWithOffset, {
  message:
    'Must be a valid ISO 8601 instant with explicit offset (e.g. 2026-02-26T11:00:00Z or 2026-02-26T13:00:00+02:00)',
});

/** Gregorian calendar date YYYY-MM-DD (invalid days such as 2026-02-31 rejected). */
export const yyyyMmDd = z.string().refine(isValidYyyyMmDd, {
  message: 'Must be a valid calendar date (YYYY-MM-DD)',
});

/**
 * Either a full instant with explicit offset, or a calendar date (YYYY-MM-DD, interpreted as UTC midnight per ECMAScript).
 */
export const iso8601CalendarDayOrInstant = z.union([
  iso8601DateTimeWithOffset,
  yyyyMmDd,
]);

/** Wall-clock time HH:mm (24h). */
export const hhMm = z
  .string()
  .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm');

/** URL slug / business identifier (stored slug; keep permissive for existing data). */
export const businessSlugParam = z.string().min(1).max(200);
