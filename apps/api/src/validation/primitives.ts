import { z } from 'zod';

/** MongoDB ObjectId as 24 hex chars (string form). */
export const mongoObjectIdString = z
  .string()
  .length(24)
  .regex(/^[a-fA-F0-9]{24}$/, 'Must be a 24-character hexadecimal ObjectId');

const HAS_OFFSET = /Z$|[+-]\d{2}:\d{2}(:\d{2})?$/;

/**
 * ISO 8601 datetime string with explicit UTC (Z) or numeric offset — no implicit local parsing.
 */
export const iso8601DateTimeWithOffset = z.string().refine(
  (s) => {
    if (!HAS_OFFSET.test(s)) return false;
    const t = Date.parse(s);
    return !Number.isNaN(t);
  },
  {
    message:
      'Must be ISO 8601 with explicit offset (e.g. 2026-02-26T11:00:00Z or 2026-02-26T13:00:00+02:00)',
  }
);

export const yyyyMmDd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

/** Wall-clock time HH:mm (24h). */
export const hhMm = z
  .string()
  .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm');

/** URL slug / business identifier (stored slug; keep permissive for existing data). */
export const businessSlugParam = z.string().min(1).max(200);
