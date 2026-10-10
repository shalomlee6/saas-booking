import type { Request } from 'express';
import type { ICustomer } from '../models/Customer';
import { HttpError } from '../errors/httpErrors';
import { recordAudit } from '../utils/recordAudit';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import {
  countCustomerNoShows,
  normalizeBookingOverride,
  resolveBookingBlock,
  resolveNoShowPolicy,
} from './customerNoShows';

export const ONLINE_BOOKING_UNAVAILABLE = {
  he: 'לא ניתן לקבוע תור אונליין. נא ליצור קשר עם העסק.',
  en: "Online booking isn't available. Please contact the business.",
} as const;

/** Hours before the visit during which the client can still cancel or reschedule. */
export const DEFAULT_CANCELLATION_WINDOW_HOURS = 24;

export function resolveCancellationWindowHours(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 24 * 30) {
    return value;
  }
  return DEFAULT_CANCELLATION_WINDOW_HOURS;
}

/** True when the visit is still at least `hours` away. */
export function isInsideCancellationWindow(start: Date, hours: number, now = new Date()): boolean {
  return start.getTime() - now.getTime() >= hours * 60 * 60 * 1000;
}

/** Product default is Hebrew. English only when the first Accept-Language tag is English. */
export function publicRequestLanguage(req: Request): 'he' | 'en' {
  const header = req.get('accept-language') ?? '';
  const first = header.split(',')[0]?.trim().toLowerCase() ?? '';
  return first.startsWith('en') ? 'en' : 'he';
}

/**
 * Lookup keys for one canonical mobile, including legacy raw-digit spellings
 * (`972501234567`, `501234567`) and the digits of the submitted value.
 */
export function publicPhoneLookupKeys(canonical: string, rawInput: string): string[] {
  const keys = new Set<string>([canonical]);
  const subscriber = canonical.startsWith('0') ? canonical.slice(1) : canonical;
  keys.add(subscriber);
  keys.add(`972${subscriber}`);
  const digits = rawInput.replace(/\D/g, '');
  if (digits) keys.add(digits);
  return [...keys];
}

/**
 * Block wins over reactivation. A blocked customer is rejected and left unchanged.
 * An inactive customer who is not blocked is reactivated by the system actor.
 */
export async function enforcePublicBookingCustomer(req: Request, customer: ICustomer): Promise<void> {
  const businessId = customer.businessId.toString();
  const settings = await ensureBusinessSettings(businessId);
  const policy = resolveNoShowPolicy(settings);
  const noShowCount = await countCustomerNoShows(businessId, customer._id.toString());
  const block = resolveBookingBlock(normalizeBookingOverride(customer.bookingOverride), policy, noShowCount);
  if (block.blocked) {
    throw new HttpError(
      403,
      ONLINE_BOOKING_UNAVAILABLE[publicRequestLanguage(req)],
      'ONLINE_BOOKING_UNAVAILABLE'
    );
  }
  if (customer.isActive === false) {
    customer.isActive = true;
    await customer.save();
    await recordAudit({
      actorEmail: 'system',
      action: 'customer.reactivated',
      entity: 'Customer',
      entityId: customer._id.toString(),
      metadata: { businessId, source: 'public_booking' },
    });
  }
}
