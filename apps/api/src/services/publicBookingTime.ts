import { DateTime } from 'luxon';

/**
 * Slot starts (HH:mm) that fit fully inside merged working ranges (opening hours + overrides).
 */
export function buildSlotsFromMergedRanges(
  ranges: Array<{ start: string; end: string }>,
  durationMinutes: number,
  slotStep: number
): string[] {
  const out: string[] = [];
  for (const range of ranges) {
    const [startH, startM] = range.start.split(':').map(Number);
    const [endH, endM] = range.end.split(':').map(Number);
    let minutes = (startH ?? 0) * 60 + (startM ?? 0);
    const endMinutes = (endH ?? 0) * 60 + (endM ?? 0);
    while (minutes + durationMinutes <= endMinutes) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      minutes += slotStep;
    }
  }
  return out;
}

/** YYYY-MM-DD + HH:mm in IANA timezone → UTC Date (Luxon). */
export function toUtcDate(dateStr: string, timeStr: string, timezone: string): Date {
  const [h, m] = timeStr.split(':').map((s) => Number(s));
  const local = DateTime.fromISO(dateStr, { zone: timezone }).set({
    hour: h,
    minute: m,
    second: 0,
    millisecond: 0,
  });

  if (!local.isValid) {
    throw new Error(`Invalid date/time: ${dateStr} ${timeStr} (${timezone})`);
  }

  return local.toUTC().toJSDate();
}
