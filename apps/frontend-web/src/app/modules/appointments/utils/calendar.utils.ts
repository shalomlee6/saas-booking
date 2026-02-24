import type { Appointment } from '../model/appointment';
import type { AppointmentCustomer, AppointmentService } from '../model/appointment';

/** Hour range for the calendar grid (inclusive start, exclusive end would be 20). */
export const CALENDAR_HOUR_START = 8;
export const CALENDAR_HOUR_END = 20;

/** Time slot interval in minutes. */
export const CALENDAR_SLOT_MINUTES = 30;

/** Pixels per minute for block positioning. Change this to make the grid taller/shorter. */
export const CALENDAR_PIXELS_PER_MINUTE = 2;

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
 * Returns Sunday 00:00:00 of the week containing the given date (week = Sun–Sat).
 */
export function getWeekStart(anchor: Date): Date {
  const d = new Date(anchor);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the next Sunday 00:00:00 after the week containing the given date.
 */
export function getWeekEnd(anchor: Date): Date {
  const start = getWeekStart(anchor);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
}

/**
 * Returns an array of 7 dates (Sun, Mon, …, Sat) for the week containing the given date.
 */
export function getWeekDays(anchor: Date): Date[] {
  const start = getWeekStart(anchor);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

/**
 * Minutes from midnight (00:00) for the given date.
 */
export function minutesFromMidnight(d: Date): number {
  return d.getUTCHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/**
 * Duration in minutes between start and end.
 */
export function durationMinutes(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (60 * 1000);
}

/**
 * Date-only key YYYY-MM-DD for grouping.
 */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Groups appointments by date key (YYYY-MM-DD). Uses start/end ISO strings.
 */
export function groupAppointmentsByDay(
  appointments: Appointment[],
  weekStart: Date,
  weekEnd: Date
): Map<string, Appointment[]> {
  const map = new Map<string, Appointment[]>();
  const startKey = toDateKey(weekStart);
  const endKey = toDateKey(new Date(weekEnd.getTime() - 1));

  for (const apt of appointments) {
    const startStr = (apt as { start?: string; startTime?: string }).start ?? (apt as { startTime?: string }).startTime;
    if (!startStr) continue;
    const startDate = new Date(startStr);
    const key = toDateKey(startDate);
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
 * top is relative to the grid body (0 = 08:00). Clamps to grid bounds.
 */
export function getAppointmentBlockLayout(
  appointment: Appointment,
  dayStart: Date
): AppointmentBlockLayout | null {
  const startStr = (appointment as { start?: string }).start;
  const endStr = (appointment as { end?: string }).end;
  if (!startStr || !endStr) return null;
  const start = new Date(startStr);
  const end = new Date(endStr);

  const startMinutes = minutesFromMidnight(start);
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

  const timeLabel = formatTimeRange(start, end);
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

function formatTimeRange(start: Date, end: Date): string {
  const sh = start.getUTCHours();
  const sm = start.getMinutes();
  const eh = end.getUTCHours();
  const em = end.getMinutes();
  const fmt = (h: number, m: number) =>
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return `${fmt(sh, sm)}–${fmt(eh, em)}`;
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

/**
 * One entry per 30-min slot (24 rows). Full-hour rows get a label (08:00, 09:00, …);
 * :30 rows get "" so labels align to 60-minute ticks while grid stays 30-min.
 */
export function getHourSlotRows(): string[] {
  const rows: string[] = [];
  for (let h = CALENDAR_HOUR_START; h < CALENDAR_HOUR_END; h++) {
    rows.push(`${String(h).padStart(2, '0')}:00`);
    if (CALENDAR_SLOT_MINUTES === 30) {
      rows.push('');
    }
  }
  return rows;
}

/** Labels for time column: 08:00, 08:30, … with isFullHour for styling. */
export function getHourLabelsWithStyle(): { label: string; isFullHour: boolean }[] {
  const labels = getHourLabels();
  return labels.map((label, i) => ({ label, isFullHour: i % 2 === 0 }));
}

/** One slot per 30 min for a day: time (HH:mm), minutesFromMidnight, disabled (outside working hours). */
export function getSlotsForDay(
  day: Date,
  workingHours: Record<string, unknown> | null | undefined
): { time: string; minutesFromMidnight: number; disabled: boolean }[] {
  const labels = getHourLabels();
  return labels.map((time, i) => {
    const minutesFromMidnight = GRID_START_MINUTES + i * CALENDAR_SLOT_MINUTES;
    const disabled = !isSlotInWorkingHours(day, minutesFromMidnight, workingHours);
    return { time, minutesFromMidnight, disabled };
  });
}

/**
 * Build query params for /appointments/new from a slot click (date = YYYY-MM-DD, time = HH:mm).
 */
export function buildNewAppointmentQueryParams(date: Date, slotMinutesFromMidnight: number): {
  date: string;
  time: string;
} {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = Math.floor(slotMinutesFromMidnight / 60);
  const min = slotMinutesFromMidnight % 60;
  return {
    date: `${y}-${m}-${d}`,
    time: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
  };
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

/** Disabled ranges for one day column: topPx/heightPx relative to grid (0 = 08:00). Uses slots. */
export function getDisabledRangesForDay(
  day: Date,
  workingHours: Record<string, unknown> | null | undefined
): { key: string; topPx: number; heightPx: number }[] {
  const result: { key: string; topPx: number; heightPx: number }[] = [];
  const dayOfWeek = day.getDay();
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
  workingHours: Record<string, unknown> | null | undefined
): boolean {
  const { enabled, slots } = getNormalizedDay(day.getDay(), workingHours);
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
