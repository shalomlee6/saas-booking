declare module 'luxon' {
  export interface DateTime {
    isValid: boolean;
    weekday: number;
    toUTC(): DateTime;
    toJSDate(): Date;
  }
  export const DateTime: {
    fromISO(iso: string, opts?: { zone: string }): DateTime;
  };
}
