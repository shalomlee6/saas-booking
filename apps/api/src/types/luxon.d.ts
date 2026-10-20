declare module 'luxon' {
  export interface DateTime {
    isValid: boolean;
    /** 1 = January … 12 = December, in this DateTime's zone. */
    month: number;
    /** Calendar day of the month in this DateTime's zone. */
    day: number;
    /** Calendar year in this DateTime's zone. */
    year: number;
    /** 1 = Monday … 7 = Sunday, in this DateTime's zone. */
    weekday: number;
    toUTC(): DateTime;
    /** The calendar date as YYYY-MM-DD in this DateTime's zone. */
    toISODate(): string | null;
    toJSDate(): Date;
    /** Start of a calendar unit in this DateTime's zone. */
    startOf(unit: 'day' | 'month'): DateTime;
    /** Subtract a calendar duration. */
    minus(duration: { days?: number; months?: number }): DateTime;
    /** Add duration, e.g. { days: 1 }, { months: 1 }, or { minutes: 30 } */
    plus(duration: { days?: number; months?: number; minutes?: number }): DateTime;
    /** Set specific time components on this DateTime */
    set(values: {
      hour?: number;
      minute?: number;
      second?: number;
      millisecond?: number;
    }): DateTime;
    /** Milliseconds since Unix epoch in UTC */
    toMillis(): number;
  }
  export const DateTime: {
    fromISO(iso: string, opts?: { zone: string }): DateTime;
    fromJSDate(date: Date, opts?: { zone?: string }): DateTime;
  };
}
