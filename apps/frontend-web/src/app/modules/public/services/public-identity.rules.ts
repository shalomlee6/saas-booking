export type IdentityMode = 'otp' | 'phone';
export type BirthdayField = 'required' | 'optional' | 'hidden';

export interface PublicClientProfile {
  verified: boolean;
  hasCustomer: boolean;
  needsBirthday: boolean;
  firstName?: string;
}

/** A device that already has a customer and does not still owe a birthday. */
export function readyToBook(profile: PublicClientProfile | null): boolean {
  return !!profile && profile.hasCustomer && !profile.needsBirthday;
}

export function isIsraeliMobile(phone: string): boolean {
  return /^05\d{8}$/.test(phone);
}

const DAYS_IN_MONTH = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** February 29 is allowed because the year is not stored. */
export function isRealBirthday(day: number, month: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month)) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= (DAYS_IN_MONTH[month] ?? 0);
}
