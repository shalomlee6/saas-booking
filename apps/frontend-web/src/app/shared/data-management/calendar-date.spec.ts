import {
  addCalendarDays,
  createdRangeForPreset,
  formatJerusalemDate,
  formatJerusalemTime,
  formatRelativeDay,
  jerusalemDateKey,
} from './calendar-date';

describe('calendar dates', () => {
  const eveningBeforeJerusalemMidnight = new Date('2026-10-03T21:30:00Z');

  it('reads the Jerusalem calendar day', () => {
    expect(jerusalemDateKey(eveningBeforeJerusalemMidnight)).toBe('2026-10-04');
  });

  it('builds half-open created ranges from Jerusalem today', () => {
    expect(createdRangeForPreset('today', eveningBeforeJerusalemMidnight)).toEqual({
      from: '2026-10-04',
      to: '2026-10-05',
    });
    expect(createdRangeForPreset('last7', eveningBeforeJerusalemMidnight)).toEqual({
      from: '2026-09-28',
      to: '2026-10-05',
    });
    expect(createdRangeForPreset('last30', eveningBeforeJerusalemMidnight)).toEqual({
      from: '2026-09-05',
      to: '2026-10-05',
    });
    expect(createdRangeForPreset('thisMonth', eveningBeforeJerusalemMidnight)).toEqual({
      from: '2026-10-01',
      to: '2026-11-01',
    });
    expect(createdRangeForPreset('previousMonth', eveningBeforeJerusalemMidnight)).toEqual({
      from: '2026-09-01',
      to: '2026-10-01',
    });
    const january = new Date('2026-01-15T12:00:00Z');
    expect(createdRangeForPreset('previousMonth', january)).toEqual({
      from: '2025-12-01',
      to: '2026-01-01',
    });
    expect(createdRangeForPreset('thisMonth', january)).toEqual({
      from: '2026-01-01',
      to: '2026-02-01',
    });
    expect(createdRangeForPreset('custom', eveningBeforeJerusalemMidnight)).toBeNull();
  });

  it('shifts calendar keys without a timezone', () => {
    expect(addCalendarDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('formats instants as dd/mm/yyyy in Asia/Jerusalem', () => {
    expect(formatJerusalemDate('2026-10-03T21:30:00Z')).toBe('04/10/2026');
    expect(formatJerusalemDate(null)).toBe('—');
  });

  it('formats the time of day in Asia/Jerusalem', () => {
    expect(formatJerusalemTime('2026-10-03T21:30:00Z')).toBe('00:30');
    expect(formatJerusalemTime(null)).toBe('');
  });

  it('describes the gap in Jerusalem calendar days', () => {
    const now = new Date('2026-10-03T09:00:00Z');
    expect(formatRelativeDay('2026-09-21T09:00:00Z', 'en', now)).toBe('12 days ago');
    expect(formatRelativeDay('2026-10-02T21:30:00Z', 'en', now)).toBe('today');
    expect(formatRelativeDay('2026-10-02T09:00:00Z', 'en', now)).toBe('yesterday');
    expect(formatRelativeDay('2026-07-05T09:00:00Z', 'en', now)).toBe('3 months ago');
    expect(formatRelativeDay('2024-09-01T09:00:00Z', 'en', now)).toBe('2 years ago');
    expect(formatRelativeDay('2026-09-21T09:00:00Z', 'he', now)).toContain('12');
    expect(formatRelativeDay(null, 'en', now)).toBe('');
  });
});
