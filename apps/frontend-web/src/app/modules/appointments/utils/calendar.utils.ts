import type { Appointment } from '../model/appointment';
import type { AppointmentCustomer, AppointmentService } from '../model/appointment';

// ─── Timezone-safe date extraction ───────────────────────────────────────────

export interface TzDateParts {
  year: number;
  month: number;    // 1–12
  day: number;      // 1–31
  hour: number;     // 0–23
  minute: number;   // 0–59
  second: number;   // 0–59
  dayOfWeek: number; // 0=Sun … 6=Sat
}

const WEEKDAY_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Extracts date/time parts for `date` rendered in `timezone`.
 * Uses Intl.DateTimeFormat.formatToParts so that all calendar arithmetic is
 * based on the business's local time, not the browser's.
 */
export function getLocalParts(date: Date, timezone: string): TzDateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    weekday: 'short',
  }).formatToParts(date);

  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  const weekdayStr = parts.find((p) => p.type === 'weekday')?.value ?? '';

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    // hour12:false can return 24 for midnight in some browsers — normalise to 0–23.
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
    dayOfWeek: WEEKDAY_SHORT_EN.indexOf(weekdayStr),
  };
}

/**
 * Returns the UTC Date that represents midnight (00:00:00) of `dateStr`
 * (YYYY-MM-DD) in the given `timezone`.
 *
 * Algorithm: anchor on UTC noon of that date (which falls within the same
 * calendar day for any timezone ±12h), then back-calculate midnight.
 */
export function businessDayStartUtc(dateStr: string, timezone: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  // UTC noon of the date — guaranteed to be the same calendar day in any
  // timezone between UTC−11 and UTC+12 (covers all real business locales).
  const utcNoon = new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, d ?? 1, 12, 0, 0));

  const { hour, minute } = getLocalParts(utcNoon, timezone);
  // UTC noon − (minutes since local midnight) = business-local midnight in UTC
  const minutesSinceMidnight = hour * 60 + minute;
  const candidate = new Date(utcNoon.getTime() - minutesSinceMidnight * 60_000);

  // Verify — one correction handles any DST edge case at midnight.
  const v = getLocalParts(candidate, timezone);
  if (v.hour === 0 && v.minute === 0) return candidate;
  const remaining = v.hour * 60 + v.minute;
  return new Date(candidate.getTime() - remaining * 60_000);
}

/**
 * UTC instant for a wall-clock calendar date + `HH:mm` in the business IANA timezone.
 *
 * Implementation scans UTC in 1-minute steps from business-local midnight through the next
 * 36 hours and matches `getLocalParts` against the target. This handles DST transitions
 * (skipped / repeated local times) using the zone rules surfaced by `Intl`.
 *
 * If the wall time does not exist (gap), returns null. If it is ambiguous (fall back), the
 * earlier UTC instant (first occurrence) is returned.
 */
export function businessWallTimeToUtc(
  dateStr: string,
  timeStr: string,
  timezone: string
): Date | null {
  const [hhRaw, mmRaw] = timeStr.trim().split(':');
  const th = Number(hhRaw);
  const tm = Number(mmRaw ?? '0');
  if (!Number.isFinite(th) || !Number.isFinite(tm)) return null;
  const targetMin = th * 60 + tm;

  const dayStart = businessDayStartUtc(dateStr, timezone);
  const endMs = dayStart.getTime() + 36 * 60 * 60 * 1000;

  for (let t = dayStart.getTime(); t < endMs; t += 60 * 1000) {
    const p = getLocalParts(new Date(t), timezone);
    const key = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
    if (key === dateStr && p.hour * 60 + p.minute === targetMin) {
      return new Date(t);
    }
  }
  return null;
}

/** Hour range for the calendar grid (inclusive start, exclusive end would be 20). */
export const CALENDAR_HOUR_START = 8;
export const CALENDAR_HOUR_END = 20;

/** Time slot interval in minutes. */
export const CALENDAR_SLOT_MINUTES = 30;

/**
 * Pixels per minute for block positioning.
 * 1.0 px/min → 30 px per 30-min slot → 720 px total grid (8am–8pm).
 * At this density the full workday (8–20) fits within the viewport on
 * standard desktop screens (1440×900: ~95 % visible, 1536×864: ~90 %,
 * 1366×768: ~77 %). Matches the "compact" density of Google Calendar /
 * Outlook dense view — professional and readable at font-size 11 px.
 */
export const CALENDAR_PIXELS_PER_MINUTE = 1.0;

/** Minimum height of an appointment block in pixels. */
export const CALENDAR_MIN_BLOCK_HEIGHT_PX = 24;

/** Default duration in minutes when creating from an empty slot (e.g. for form prefill). */
export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 30;

/** Total minutes from midnight for the grid start (e.g. 8*60 = 480). */
export const GRID_START_MINUTES = CALENDAR_HOUR_START * 60;

/** Total minutes from midnight for the grid end (e.g. 20*60 = 1200). */
export const GRID_END_MINUTES = CALENDAR_HOUR_END * 60;

/** Total height in pixels of the scrollable grid body (one column). */
export const GRID_BODY_HEIGHT_PX =
  (GRID_END_MINUTES - GRID_START_MINUTES) * CALENDAR_PIXELS_PER_MINUTE;

/** Height of one time-slot row in pixels (e.g. 30 * 2 = 60). */
export const CALENDAR_SLOT_HEIGHT_PX =
  CALENDAR_SLOT_MINUTES * CALENDAR_PIXELS_PER_MINUTE;

/**
 * Normalizes any value into a valid Date or null (supports Date or ISO/string).
 */
export function asDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? null : v;
  }
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Minutes from midnight (00:00) for the given UTC Date, rendered in `timezone`.
 * Used for block top-position calculation — must match the business's local clock.
 */
export function minutesFromMidnight(d: Date, timezone: string): number {
  const { hour, minute, second } = getLocalParts(d, timezone);
  return hour * 60 + minute + second / 60;
}

/**
 * Duration in minutes between start and end (timezone-independent — always UTC diff).
 */
export function durationMinutes(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (60 * 1000);
}

/**
 * Date-only key YYYY-MM-DD for a UTC Date rendered in `timezone`.
 * Used for grouping appointments by day and comparing with "today".
 */
export function toDateKey(d: Date, timezone: string): string {
  const { year, month, day } = getLocalParts(d, timezone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Groups appointments by date key (YYYY-MM-DD) in the business `timezone`.
 * An appointment whose UTC start time falls on Tuesday 23:30 in UTC but
 * Wednesday 02:30 in the business timezone will be grouped under Wednesday.
 */
export function groupAppointmentsByDay(
  appointments: Appointment[],
  weekStart: Date,
  weekEnd: Date,
  timezone: string
): Map<string, Appointment[]> {
  const map = new Map<string, Appointment[]>();
  const startKey = toDateKey(weekStart, timezone);
  const endKey = toDateKey(new Date(weekEnd.getTime() - 1), timezone);

  for (const apt of appointments) {
    const startVal = (apt as any).start ?? (apt as any).startTime;
    const startDate = asDate(startVal);
    if (!startDate) continue;
    const key = toDateKey(startDate, timezone);
    if (key < startKey || key > endKey) continue;
    const list = map.get(key) ?? [];
    list.push(apt);
    map.set(key, list);
  }

  return map;
}

export interface AppointmentBlockLayout {
  appointment: Appointment;
  topPx: number;
  heightPx: number;
  timeLabel: string;
  customerName: string;
  serviceName: string;
  status: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

/**
 * Computes layout for one appointment: top (px), height (px), and labels.
 * All times are resolved in `timezone` so the block lands on the correct
 * pixel row regardless of the browser's local clock.
 * top is relative to the grid body (0 = 08:00). Clamps to grid bounds.
 */
export function getAppointmentBlockLayout(
  appointment: Appointment,
  dayStart: Date,
  timezone: string
): AppointmentBlockLayout | null {
  const start = asDate((appointment as any).start ?? (appointment as any).startTime);
  const end = asDate((appointment as any).end ?? (appointment as any).endTime);
  if (!start || !end) {
    return null;
  }

  const startMinutes = minutesFromMidnight(start, timezone);
  const dur = durationMinutes(start, end);
  if (dur <= 0) return null;

  let topMinutes = startMinutes - GRID_START_MINUTES;
  let heightMinutes = dur;
  if (topMinutes + heightMinutes <= 0 || topMinutes >= GRID_END_MINUTES - GRID_START_MINUTES) {
    return null;
  }
  if (topMinutes < 0) {
    heightMinutes += topMinutes;
    topMinutes = 0;
  }
  if (topMinutes + heightMinutes > GRID_END_MINUTES - GRID_START_MINUTES) {
    heightMinutes = GRID_END_MINUTES - GRID_START_MINUTES - topMinutes;
  }

  const topPx = topMinutes * CALENDAR_PIXELS_PER_MINUTE;
  let heightPx = heightMinutes * CALENDAR_PIXELS_PER_MINUTE;
  if (heightPx < CALENDAR_MIN_BLOCK_HEIGHT_PX) heightPx = CALENDAR_MIN_BLOCK_HEIGHT_PX;

  const timeLabel = formatTimeRange(start, end, timezone);
  const customerName = getCustomerDisplay(appointment);
  const serviceName = getServiceDisplay(appointment);
  const status = appointment.status ?? '';
  const customerId =
    typeof appointment.customerId === 'object' && appointment.customerId && '_id' in appointment.customerId
      ? (appointment.customerId as { _id: string })._id
      : (appointment.customerId as string) ?? appointment._id;
  const colors = idToBlockColors(customerId);

  return {
    appointment,
    topPx,
    heightPx,
    timeLabel,
    customerName,
    serviceName,
    status,
    bgColor: colors.bgColor,
    textColor: colors.textColor,
    borderColor: colors.borderColor,
  };
}

/** Format a time range as "HH:mm–HH:mm" in the business timezone. */
function formatTimeRange(start: Date, end: Date, timezone: string): string {
  const sp = getLocalParts(start, timezone);
  const ep = getLocalParts(end, timezone);
  const fmt = (h: number, m: number) =>
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return `${fmt(sp.hour, sp.minute)}–${fmt(ep.hour, ep.minute)}`;
}

function getCustomerDisplay(apt: Appointment): string {
  if ((apt as { customerName?: string }).customerName) return (apt as { customerName: string }).customerName;
  const c = apt.customerId;
  if (c && typeof c === 'object' && 'name' in c) return (c as AppointmentCustomer).name;
  return typeof c === 'string' ? c : '—';
}

function getServiceDisplay(apt: Appointment): string {
  if ((apt as { serviceName?: string }).serviceName) return (apt as { serviceName: string }).serviceName;
  const s = apt.serviceId;
  if (s && typeof s === 'object' && 'name' in s) return (s as AppointmentService).name;
  return typeof s === 'string' ? s : '—';
}

/**
 * Hour labels for the left column (one per 30-min row): 08:00, 08:30, ..., 19:30.
 */
export function getHourLabels(): string[] {
  const labels: string[] = [];
  for (let h = CALENDAR_HOUR_START; h < CALENDAR_HOUR_END; h++) {
    labels.push(`${String(h).padStart(2, '0')}:00`);
    if (CALENDAR_SLOT_MINUTES === 30) {
      labels.push(`${String(h).padStart(2, '0')}:30`);
    }
  }
  return labels;
}

/** Labels for time column: 08:00, 08:30, … with isFullHour for styling. */
export function getHourLabelsWithStyle(): { label: string; isFullHour: boolean }[] {
  const labels = getHourLabels();
  return labels.map((label, i) => ({ label, isFullHour: i % 2 === 0 }));
}

/** One slot per 30 min for a day: time (HH:mm), minutesFromMidnight, disabled (outside working hours). */
export function getSlotsForDay(
  day: Date,
  workingHours: Record<string, unknown> | null | undefined,
  timezone: string
): { time: string; minutesFromMidnight: number; disabled: boolean }[] {
  const labels = getHourLabels();
  return labels.map((time, i) => {
    const minutesFromMidnight = GRID_START_MINUTES + i * CALENDAR_SLOT_MINUTES;
    const disabled = !isSlotInWorkingHours(day, minutesFromMidnight, workingHours, timezone);
    return { time, minutesFromMidnight, disabled };
  });
}

// ——— Working hours (businessSettings.workingHours: slots format) ———
import {
  WORKING_HOURS_DAY_KEYS,
  normalizeDayToSlots,
  minutesToSlotIndex,
  getDaySummary,
  type WorkingHoursDaySlots,
} from '../../../core/working-hours/working-hours.util';

const GRID_FIRST_SLOT_INDEX = (CALENDAR_HOUR_START * 60) / 30;
const GRID_LAST_SLOT_INDEX = (CALENDAR_HOUR_END * 60) / 30 - 1;

function getNormalizedDay(
  dayOfWeek: number,
  workingHours: Record<string, unknown> | null | undefined
): WorkingHoursDaySlots {
  const key = WORKING_HOURS_DAY_KEYS[dayOfWeek];
  return normalizeDayToSlots(workingHours?.[key] as Record<string, unknown>, key);
}

/**
 * Disabled ranges for one day column: topPx/heightPx relative to grid (0 = 08:00).
 * Uses `timezone` to resolve the correct day-of-week for the business locale.
 */
export function getDisabledRangesForDay(
  day: Date,
  workingHours: Record<string, unknown> | null | undefined,
  timezone: string
): { key: string; topPx: number; heightPx: number }[] {
  const result: { key: string; topPx: number; heightPx: number }[] = [];
  const { dayOfWeek } = getLocalParts(day, timezone);
  const { enabled, slots } = getNormalizedDay(dayOfWeek, workingHours);
  const slotHeightPx = CALENDAR_SLOT_MINUTES * CALENDAR_PIXELS_PER_MINUTE;

  if (!enabled) {
    result.push({ key: 'all', topPx: 0, heightPx: GRID_BODY_HEIGHT_PX });
    return result;
  }

  let runStart: number | null = null;
  for (let idx = GRID_FIRST_SLOT_INDEX; idx <= GRID_LAST_SLOT_INDEX; idx++) {
    const available = slots[idx] === true;
    if (!available) {
      if (runStart === null) runStart = idx;
    } else {
      if (runStart !== null) {
        const topPx = (runStart - GRID_FIRST_SLOT_INDEX) * slotHeightPx;
        const heightPx = (idx - runStart) * slotHeightPx;
        result.push({ key: `gap-${runStart}`, topPx, heightPx });
        runStart = null;
      }
    }
  }
  if (runStart !== null) {
    const topPx = (runStart - GRID_FIRST_SLOT_INDEX) * slotHeightPx;
    const heightPx = (GRID_LAST_SLOT_INDEX - runStart + 1) * slotHeightPx;
    result.push({ key: `gap-${runStart}`, topPx, heightPx });
  }
  return result;
}

export function isSlotInWorkingHours(
  day: Date,
  slotMinutesFromMidnight: number,
  workingHours: Record<string, unknown> | null | undefined,
  timezone: string
): boolean {
  const { dayOfWeek } = getLocalParts(day, timezone);
  const { enabled, slots } = getNormalizedDay(dayOfWeek, workingHours);
  if (!enabled) return false;
  const idx = minutesToSlotIndex(slotMinutesFromMidnight);
  return slots[idx] === true;
}

/** Human-readable summary for a day (e.g. calendar tooltip). */
export function getWorkingHoursSummary(
  dayOfWeek: number,
  workingHours: Record<string, unknown> | null | undefined
): string {
  const day = getNormalizedDay(dayOfWeek, workingHours);
  return getDaySummary(day);
}

// ——— Deterministic block colors (customerId / appointmentId) ———
/** Simple string hash for deterministic hue. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/**
 * Deterministic pastel background + dark text from an id (e.g. customerId).
 * Returns CSS-ready values for background, text, and left border.
 */
export function idToBlockColors(id: string): {
  bgColor: string;
  textColor: string;
  borderColor: string;
} {
  const hash = hashString(id || 'default');
  const hue = hash % 360;
  const saturation = 55;
  const lightness = 92;
  const bgColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  const textColor = 'var(--text-primary)';
  const borderColor = `hsl(${hue}, ${Math.min(saturation + 20, 80)}%, ${Math.max(lightness - 25, 35)}%)`;
  return { bgColor, textColor, borderColor };
}
