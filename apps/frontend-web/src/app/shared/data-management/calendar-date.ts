/** Calendar dates for the customers list. The API reads YYYY-MM-DD in the business zone. */
export const BUSINESS_TIME_ZONE = 'Asia/Jerusalem';

/** `yyyy-mm-dd` for the current calendar day in Asia/Jerusalem. */
export function jerusalemDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Shift a `yyyy-mm-dd` key by whole calendar days. The key itself has no timezone. */
export function addCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const utc = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  utc.setUTCDate(utc.getUTCDate() + days);
  const nextYear = utc.getUTCFullYear();
  const nextMonth = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(utc.getUTCDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

/** Calendar day the user picked in the date picker, as `yyyy-mm-dd`. */
export function calendarKeyFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateFromCalendarKey(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/**
 * Half-open created range for a preset: `from` inclusive, `to` exclusive.
 * Matches `resolveDateRange` (today, last 7, last 30, this month, previous month).
 */
export function createdRangeForPreset(
  preset: string,
  now = new Date()
): { from: string; to: string } | null {
  const today = jerusalemDateKey(now);
  const tomorrow = addCalendarDays(today, 1);
  if (preset === 'today') return { from: today, to: tomorrow };
  if (preset === 'last7') return { from: addCalendarDays(today, -6), to: tomorrow };
  if (preset === 'last30') return { from: addCalendarDays(today, -29), to: tomorrow };
  if (preset === 'thisMonth') {
    const [year, month] = today.split('-').map(Number);
    const from = `${today.slice(0, 7)}-01`;
    const nextMonth = month === 12 ? 1 : (month ?? 1) + 1;
    const nextYear = month === 12 ? (year ?? 0) + 1 : year;
    return { from, to: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01` };
  }
  if (preset === 'previousMonth') {
    const [year, month] = today.split('-').map(Number);
    const prevMonth = month === 1 ? 12 : (month ?? 1) - 1;
    const prevYear = month === 1 ? (year ?? 0) - 1 : year;
    return {
      from: `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`,
      to: `${today.slice(0, 7)}-01`,
    };
  }
  return null;
}

/** `dd/mm/yyyy` in Asia/Jerusalem. */
export function formatJerusalemDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/** `HH:mm` (24h) in Asia/Jerusalem, or an empty string when the value is missing or invalid. */
export function formatJerusalemTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function daysBetweenKeys(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const ms = Date.UTC(ty, (tm ?? 1) - 1, td ?? 1) - Date.UTC(fy, (fm ?? 1) - 1, fd ?? 1);
  return Math.round(ms / 86_400_000);
}

/**
 * Whole-day relative hint such as "12 days ago" / "לפני 12 ימים", counted in Jerusalem
 * calendar days. Days below 30, then months, then years. Empty when the value is missing.
 */
export function formatRelativeDay(
  value: string | null | undefined,
  locale: string,
  now = new Date()
): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diff = daysBetweenKeys(jerusalemDateKey(date), jerusalemDateKey(now));
  const sign = diff >= 0 ? -1 : 1;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (abs < 30) return rtf.format(sign * abs, 'day');
  if (abs < 365) return rtf.format(sign * Math.floor(abs / 30), 'month');
  return rtf.format(sign * Math.floor(abs / 365), 'year');
}
