/** 30-minute slots for 24h: 00:00 (0) .. 23:30 (47). */
export const SLOTS_PER_DAY = 48;

export const WORKING_HOURS_DAY_KEYS = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
] as const;

export type WorkingHoursDayKey = (typeof WORKING_HOURS_DAY_KEYS)[number];

export interface WorkingHoursDaySlots {
  enabled: boolean;
  slots: boolean[];
}

export type WorkingHoursSlots = Record<string, WorkingHoursDaySlots>;

/** Slot index 0 = 00:00, 1 = 00:30, ... 47 = 23:30. */
export function slotIndexToMinutes(index: number): number {
  return index * 30;
}

export function minutesToSlotIndex(minutes: number): number {
  const i = Math.floor(minutes / 30);
  return Math.max(0, Math.min(SLOTS_PER_DAY - 1, i));
}

function parseHHmm(s: string): number {
  const [h, m] = (s || '00:00').split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Default: Mon–Fri 08:00–18:00, Sat 08:00–13:00, Sun closed. */
export function createDefaultSlots(dayKey: string): boolean[] {
  const slots = new Array<boolean>(SLOTS_PER_DAY).fill(false);
  // if (dayKey === 'sun') return slots;
  const startIdx = minutesToSlotIndex(8 * 60);
  const endIdx =
    dayKey === 'fri'
      ? minutesToSlotIndex(14.5 * 60)
      : minutesToSlotIndex(18 * 60);
  for (let i = startIdx; i < endIdx; i++) slots[i] = true;
  return slots;
}

/** Convert legacy { enabled, start, end } or { enabled, ranges } to { enabled, slots }. */
export function normalizeDayToSlots(
  raw: Record<string, unknown> | null | undefined,
  dayKey: string
): WorkingHoursDaySlots {
  const defaultSlots = createDefaultSlots(dayKey);
  if (!raw || typeof raw !== 'object') {
    return { enabled: dayKey !== 'sat', slots: defaultSlots };
  }
  const arr = (raw as { slots?: boolean[] }).slots;
  if (Array.isArray(arr) && arr.length === SLOTS_PER_DAY) {
    return {
      enabled: !!(raw as { enabled?: boolean }).enabled,
      slots: [...arr],
    };
  }
  const slots = new Array<boolean>(SLOTS_PER_DAY).fill(false);
  const enabled = !!(raw as { enabled?: boolean }).enabled;
  const startStr = (raw as { start?: string }).start;
  const endStr = (raw as { end?: string }).end;
  const ranges = (raw as { ranges?: { start: string; end: string; enabled: boolean }[] }).ranges;
  if (ranges && Array.isArray(ranges)) {
    for (const r of ranges) {
      if (!r.enabled) continue;
      const a = minutesToSlotIndex(parseHHmm(r.start));
      const b = minutesToSlotIndex(parseHHmm(r.end));
      for (let i = a; i < b; i++) slots[i] = true;
    }
    return { enabled, slots };
  }
  if (startStr != null && endStr != null && enabled) {
    const a = minutesToSlotIndex(parseHHmm(startStr));
    const b = minutesToSlotIndex(parseHHmm(endStr));
    for (let i = a; i < b; i++) slots[i] = true;
  }
  return { enabled, slots };
}

/** Human-readable summary: "Closed" or "Open: 08:00–18:00 (20 blocks)". */
export function getDaySummary(day: WorkingHoursDaySlots): string {
  const { enabled, slots } = day;
  if (!enabled) return 'Closed';
  let count = 0;
  for (const s of slots) if (s) count++;
  if (count === 0) return 'Closed';
  const runs: { start: number; end: number }[] = [];
  let runStart = -1;
  for (let i = 0; i < SLOTS_PER_DAY; i++) {
    if (slots[i]) {
      if (runStart < 0) runStart = i;
    } else {
      if (runStart >= 0) {
        runs.push({ start: runStart, end: i });
        runStart = -1;
      }
    }
  }
  if (runStart >= 0) runs.push({ start: runStart, end: SLOTS_PER_DAY });
  const fmt = (idx: number) => {
    const h = Math.floor(slotIndexToMinutes(idx) / 60);
    const m = slotIndexToMinutes(idx) % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  const rangeStrs = runs.map((r) => `${fmt(r.start)}–${fmt(r.end)}`);
  const extra = count > 0 ? ` (${count} blocks)` : '';
  return `Open: ${rangeStrs.join(', ')}${extra}`;
}

/** Display label for slot index, e.g. "08:00". */
export function slotIndexToLabel(index: number): string {
  const m = slotIndexToMinutes(index);
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Create empty slots (all false). */
export function createEmptySlots(): boolean[] {
  return new Array<boolean>(SLOTS_PER_DAY).fill(false);
}

/** Set range [startIdx, endIdx) to value. */
export function setSlotsRange(
  slots: boolean[],
  startIdx: number,
  endIdx: number,
  value: boolean
): void {
  for (let i = startIdx; i < endIdx && i < slots.length; i++) slots[i] = value;
}
