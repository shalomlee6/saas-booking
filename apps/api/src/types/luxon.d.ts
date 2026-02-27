declare module 'luxon' {
  export interface DateTime {
    isValid: boolean;
    weekday: number;
    toUTC(): DateTime;
    toJSDate(): Date;
    /** Start of a unit, we only need 'day' here */
    startOf(unit: 'day'): DateTime;
    /** Add duration, e.g. { days: 1 } or { minutes: 30 } */
    plus(duration: { days?: number; minutes?: number }): DateTime;
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
    fromJSDate(date: Date): DateTime;
  };
}
