/** Days per month. February allows 29 because the year is not stored. */
const DAYS_IN_MONTH = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export interface Birthday {
  day: number;
  month: number;
}

export function isRealBirthday(day: number, month: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month)) return false;
  if (month < 1 || month > 12) return false;
  const max = DAYS_IN_MONTH[month] ?? 0;
  return day >= 1 && day <= max;
}
