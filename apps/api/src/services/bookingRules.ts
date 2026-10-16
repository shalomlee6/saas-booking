import { DateTime } from 'luxon';
import { Types } from 'mongoose';
import { Appointment } from '../models/Appointment';
import { HttpError } from '../errors/httpErrors';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { publicRequestLanguage } from './publicBookingPolicy';
import type { Request } from 'express';
import type { ReliabilityPolicy } from './customerNoShows';

export const LEAD_MINUTE_OPTIONS = [0, 30, 60, 120, 180, 360, 720, 1440] as const;
export const BUFFER_MINUTE_OPTIONS = [0, 5, 10, 15, 20, 30] as const;
export const MAX_ACTIVE_OPTIONS = [1, 2, 3, 5, 10] as const;

export type OnlineDefaultStatus = 'confirmed' | 'pending';

export interface OnlineBookingRules {
  enabled: boolean;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  bufferMinutes: number;
  onlineDefaultStatus: OnlineDefaultStatus;
  /** `null` means unlimited. */
  maxActiveAppointmentsPerClient: number | null;
  clientCanCancelOnline: boolean;
  cancellationWindowHours: number;
}

const DEFAULT_RULES: OnlineBookingRules = {
  enabled: true,
  minLeadMinutes: 60,
  maxAdvanceDays: 60,
  bufferMinutes: 0,
  onlineDefaultStatus: 'confirmed',
  maxActiveAppointmentsPerClient: null,
  clientCanCancelOnline: true,
  cancellationWindowHours: 24,
};

export const BOOKING_RULE_MESSAGES = {
  TOO_SOON: {
    he: 'השעה קרובה מדי. נא לבחור שעה מאוחרת יותר.',
    en: 'That time is too soon. Please choose a later time.',
  },
  TOO_FAR: {
    he: 'לא ניתן לקבוע תור כל כך רחוק.',
    en: 'That date is too far ahead.',
  },
  ONLINE_BOOKING_DISABLED: {
    he: 'ההזמנה אונליין סגורה כרגע. נא ליצור קשר עם העסק.',
    en: 'Online booking is closed right now. Please contact the business.',
  },
  ONLINE_CANCEL_DISABLED: {
    he: 'לא ניתן לבטל תור אונליין. נא ליצור קשר עם העסק.',
    en: "Online cancellation isn't available. Please contact the business.",
  },
  MAX_ACTIVE_APPOINTMENTS: {
    he: 'הגעת למספר התורים המרבי שניתן לקבוע מראש. לתור נוסף נא ליצור קשר עם העסק.',
    en: "You've reached the maximum number of upcoming appointments. Please contact the business to book another.",
  },
} as const;

type RuleCode = keyof typeof BOOKING_RULE_MESSAGES;

interface SettingsSource {
  cancellationWindowHours?: number;
  onlineBooking?: {
    enabled?: boolean;
    minLeadMinutes?: number;
    maxAdvanceDays?: number;
    bufferMinutes?: number;
    onlineDefaultStatus?: string;
    maxActiveAppointmentsPerClient?: number | null;
    clientCanCancelOnline?: boolean;
  } | null;
}

function oneOf<T extends number>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === 'number' && options.includes(value as T) ? (value as T) : fallback;
}

/** Missing fields keep today's behavior, except the new 60-minute lead default. */
export function resolveOnlineBookingRules(source: SettingsSource | null | undefined): OnlineBookingRules {
  const raw = source?.onlineBooking;
  const windowHours = source?.cancellationWindowHours;
  const windowOk =
    typeof windowHours === 'number' && Number.isInteger(windowHours) && windowHours >= 0 && windowHours <= 24 * 30;
  const maxDays = raw?.maxAdvanceDays;
  const maxOk = typeof maxDays === 'number' && Number.isInteger(maxDays) && maxDays >= 7 && maxDays <= 365;
  const cap = raw?.maxActiveAppointmentsPerClient;
  const capOk = cap === null || (typeof cap === 'number' && (MAX_ACTIVE_OPTIONS as readonly number[]).includes(cap));
  const status = raw?.onlineDefaultStatus === 'pending' ? 'pending' : 'confirmed';
  return {
    enabled: raw?.enabled !== false,
    minLeadMinutes: oneOf(raw?.minLeadMinutes, LEAD_MINUTE_OPTIONS, DEFAULT_RULES.minLeadMinutes),
    maxAdvanceDays: maxOk ? maxDays : DEFAULT_RULES.maxAdvanceDays,
    bufferMinutes: oneOf(raw?.bufferMinutes, BUFFER_MINUTE_OPTIONS, DEFAULT_RULES.bufferMinutes),
    onlineDefaultStatus: raw?.onlineDefaultStatus === undefined ? DEFAULT_RULES.onlineDefaultStatus : status,
    maxActiveAppointmentsPerClient: capOk ? (cap ?? null) : null,
    clientCanCancelOnline: raw?.clientCanCancelOnline !== false,
    cancellationWindowHours: windowOk ? windowHours : DEFAULT_RULES.cancellationWindowHours,
  };
}

/** A slot at exactly `now + lead` is allowed. */
export function isBeforeLead(start: Date, minLeadMinutes: number, now = new Date()): boolean {
  return start.getTime() < now.getTime() + minLeadMinutes * 60 * 1000;
}

/** The calendar day `maxAdvanceDays` ahead is allowed. Later days are not. */
export function isBeyondMaxAdvance(
  dateStr: string,
  maxAdvanceDays: number,
  timezone: string,
  now = new Date()
): boolean {
  const today = DateTime.fromJSDate(now, { zone: timezone }).startOf('day');
  const day = DateTime.fromISO(dateStr, { zone: timezone }).startOf('day');
  if (!day.isValid || !today.isValid) return true;
  return day > today.plus({ days: maxAdvanceDays });
}

/**
 * Both intervals keep `bufferMs` free after their stored end.
 * Stored appointment end is not changed.
 */
export function rangesOverlapWithBuffer(
  startMs: number,
  endMs: number,
  otherStartMs: number,
  otherEndMs: number,
  bufferMs: number
): boolean {
  return startMs < otherEndMs + bufferMs && endMs + bufferMs > otherStartMs;
}

export function ruleError(code: RuleCode, lang: 'he' | 'en'): HttpError {
  const status = code === 'ONLINE_BOOKING_DISABLED' ? 403 : 409;
  return new HttpError(status, BOOKING_RULE_MESSAGES[code][lang], code);
}

export function ruleErrorForRequest(req: Request, code: RuleCode): HttpError {
  return ruleError(code, publicRequestLanguage(req));
}

export async function countActiveUpcoming(
  businessId: string,
  customerId: string,
  excludeAppointmentId?: string,
  now = new Date()
): Promise<number> {
  return Appointment.countDocuments({
    businessId,
    customerId,
    status: { $in: ['pending', 'confirmed'] },
    start: { $gt: now },
    ...(excludeAppointmentId ? { _id: { $ne: excludeAppointmentId } } : {}),
  });
}

export async function assertUnderActiveLimit(
  req: Request,
  businessId: string,
  customerId: string,
  rules: OnlineBookingRules,
  excludeAppointmentId?: string
): Promise<void> {
  const limit = rules.maxActiveAppointmentsPerClient;
  if (limit == null) return;
  const count = await countActiveUpcoming(businessId, customerId, excludeAppointmentId);
  if (count >= limit) {
    throw ruleErrorForRequest(req, 'MAX_ACTIVE_APPOINTMENTS');
  }
}

export function assertPublicSlotWindow(
  req: Request,
  rules: OnlineBookingRules,
  dateStr: string,
  start: Date,
  timezone: string
): void {
  if (!rules.enabled) throw ruleErrorForRequest(req, 'ONLINE_BOOKING_DISABLED');
  if (isBeyondMaxAdvance(dateStr, rules.maxAdvanceDays, timezone)) {
    throw ruleErrorForRequest(req, 'TOO_FAR');
  }
  // A start that is already in the past stays START_IN_PAST from the appointment write.
  // Lead time only rejects a future start that is still inside the notice window.
  if (start.getTime() > Date.now() && isBeforeLead(start, rules.minLeadMinutes)) {
    throw ruleErrorForRequest(req, 'TOO_SOON');
  }
}

export async function readBufferMinutes(businessId: Types.ObjectId | string): Promise<number> {
  const settings = await ensureBusinessSettings(businessId);
  return resolveOnlineBookingRules(settings).bufferMinutes;
}

function counterSentence(
  lang: 'he' | 'en',
  enabled: boolean,
  threshold: number,
  heLabel: string,
  enLabel: string
): string | null {
  if (!enabled) return null;
  return lang === 'he'
    ? `חסימה אוטומטית אחרי ${threshold} ${heLabel}`
    : `Online booking is blocked after ${threshold} ${enLabel}`;
}

/** Read-only policy built from the saved rules. No free-text field. */
export function buildClientPolicyText(
  rules: OnlineBookingRules,
  reliability: ReliabilityPolicy,
  lang: 'he' | 'en'
): string {
  const lookback =
    reliability.lookback === 'all'
      ? lang === 'he'
        ? 'לאורך כל התקופה'
        : 'across all time'
      : lang === 'he'
        ? 'ב-12 החודשים האחרונים'
        : 'in the last 12 months';
  const lead =
    lang === 'he'
      ? rules.minLeadMinutes === 0
        ? 'אפשר לקבוע תור גם סמוך למועד.'
        : `אפשר לקבוע תור לפחות ${rules.minLeadMinutes} דקות מראש.`
      : rules.minLeadMinutes === 0
        ? 'You can book right up to the visit.'
        : `Book at least ${rules.minLeadMinutes} minutes ahead.`;
  const advance =
    lang === 'he'
      ? `אפשר לקבוע עד ${rules.maxAdvanceDays} ימים קדימה.`
      : `You can book up to ${rules.maxAdvanceDays} days ahead.`;
  const cancel = !rules.clientCanCancelOnline
    ? lang === 'he'
      ? 'לא ניתן לבטל תור אונליין.'
      : "Online cancellation isn't available."
    : rules.cancellationWindowHours === 0
      ? lang === 'he'
        ? 'אפשר לבטל תור אונליין עד מועד התור.'
        : 'You can cancel online until the visit starts.'
      : lang === 'he'
        ? `אפשר לבטל תור אונליין עד ${rules.cancellationWindowHours} שעות לפני התור.`
        : `You can cancel online until ${rules.cancellationWindowHours} hours before the visit.`;
  const cap =
    rules.maxActiveAppointmentsPerClient == null
      ? lang === 'he'
        ? 'אין הגבלה על מספר התורים העתידיים.'
        : 'There is no limit on upcoming appointments.'
      : lang === 'he'
        ? `אפשר להחזיק עד ${rules.maxActiveAppointmentsPerClient} תורים עתידיים במקביל.`
        : `You can hold up to ${rules.maxActiveAppointmentsPerClient} upcoming appointments at once.`;
  const blocks = [
    counterSentence(lang, reliability.noShow.enabled, reliability.noShow.threshold, 'אי-הגעות', 'no-shows'),
    counterSentence(
      lang,
      reliability.lateCancellation.enabled,
      reliability.lateCancellation.threshold,
      'ביטולים מאוחרים',
      'late cancellations'
    ),
    counterSentence(
      lang,
      reliability.lateArrival.enabled,
      reliability.lateArrival.threshold,
      'איחורים',
      'late arrivals'
    ),
  ].filter((line): line is string => !!line);
  const blockText =
    blocks.length === 0
      ? lang === 'he'
        ? 'אין חסימה אוטומטית.'
        : 'There is no automatic block.'
      : `${blocks.join(lang === 'he' ? ', ' : ', ')} ${lookback}.`;
  return [lead, advance, cancel, cap, blockText].join(' ');
}
