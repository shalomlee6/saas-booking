import { randomInt } from 'crypto';
import { Types } from 'mongoose';
import { Business } from '../models/Business';
import { Customer } from '../models/Customer';
import { OtpChallenge } from '../models/OtpChallenge';
import { HttpError, NotFoundError, ValidationError } from '../errors/httpErrors';
import { canonicalLocalPhone } from '../listQuery/search';
import { publicPhoneLookupKeys } from './publicBookingPolicy';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import {
  attachCustomerToSession,
  savePublicClientBinding,
} from '../utils/publicCustomerSession';
import type { PublicCustomer } from '../types/publicCustomer';
import {
  countCustomerNoShows,
  normalizeBookingOverride,
  resolveBookingBlock,
  resolveNoShowPolicy,
} from './customerNoShows';
import { isRealBirthday, type Birthday } from './birthday';
import { getSmsProvider } from './smsProvider';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_MS = 30 * 1000;

export type IdentityMode = 'otp' | 'phone';
export type IdentifyStatus = 'known' | 'new' | 'blocked';
export type BirthdayField = 'required' | 'optional' | 'hidden';

export function resolveIdentityMode(): IdentityMode {
  const raw = process.env.IDENTITY_MODE?.trim().toLowerCase();
  if (raw === 'otp' || raw === 'phone') return raw;
  return process.env.NODE_ENV === 'production' ? 'phone' : 'otp';
}

export function resolveBirthdayField(value: unknown): BirthdayField {
  return value === 'optional' || value === 'hidden' ? value : 'required';
}

function requireMobile(raw: unknown): string {
  const phone = canonicalLocalPhone(typeof raw === 'string' ? raw : '');
  if (!phone) {
    throw new ValidationError('Enter an Israeli mobile (05 and 8 digits)');
  }
  return phone;
}

function firstNameOf(customer: { firstName?: string; name?: string }): string {
  const explicit = customer.firstName?.trim();
  if (explicit) return explicit;
  const name = customer.name?.trim() ?? '';
  return name.split(/\s+/)[0] ?? '';
}

async function loadBusiness(slug: string) {
  const business = await Business.findOne({ slug: slug.trim() });
  if (!business) throw new NotFoundError('Business not found');
  return business;
}

async function findCustomer(businessId: Types.ObjectId, phone: string) {
  return Customer.findOne({ businessId, phone: { $in: publicPhoneLookupKeys(phone, phone) } });
}

export async function readPublicConfig(slug: string): Promise<{
  identityMode: IdentityMode;
  birthdayField: BirthdayField;
}> {
  const business = await loadBusiness(slug);
  const settings = await ensureBusinessSettings(business._id);
  return {
    identityMode: resolveIdentityMode(),
    birthdayField: resolveBirthdayField(settings.birthdayField),
  };
}

export interface IdentifyStartResult {
  status: IdentifyStatus;
  session?: PublicCustomer;
}

export async function startIdentify(
  slug: string,
  rawPhone: unknown,
  existingSessionId?: string
): Promise<IdentifyStartResult> {
  const phone = requireMobile(rawPhone);
  const business = await loadBusiness(slug);
  const customer = await findCustomer(business._id, phone);
  if (customer) {
    const settings = await ensureBusinessSettings(business._id);
    const count = await countCustomerNoShows(business._id.toString(), customer._id.toString());
    const block = resolveBookingBlock(
      normalizeBookingOverride(customer.bookingOverride),
      resolveNoShowPolicy(settings),
      count
    );
    if (block.blocked) return { status: 'blocked' };
  }

  const status: IdentifyStatus = customer ? 'known' : 'new';
  const mode = resolveIdentityMode();
  if (mode === 'phone') {
    const session = await savePublicClientBinding({
      existingSessionId,
      businessId: business._id,
      slug: business.slug,
      phone,
      customerId: customer?._id,
      verified: false,
    });
    return { status, session };
  }

  await sendOtp(business.slug, phone);
  return { status };
}

async function sendOtp(businessSlug: string, phone: string): Promise<void> {
  const now = new Date();
  const existing = await OtpChallenge.findOne({ businessSlug, phone });
  if (
    existing &&
    existing.expiresAt.getTime() > now.getTime() &&
    existing.attempts < OTP_MAX_ATTEMPTS &&
    now.getTime() - existing.lastSentAt.getTime() < OTP_RESEND_MS
  ) {
    throw new HttpError(429, 'Please wait before requesting another code');
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
  await OtpChallenge.findOneAndUpdate(
    { businessSlug, phone },
    { businessSlug, phone, code, attempts: 0, lastSentAt: now, expiresAt },
    { upsert: true, new: true }
  );
  try {
    await getSmsProvider().send(phone, `קוד האימות שלך: ${code}`);
  } catch (error) {
    await OtpChallenge.deleteOne({ businessSlug, phone });
    throw error;
  }
}

export async function verifyIdentify(
  slug: string,
  rawPhone: unknown,
  rawCode: unknown,
  existingSessionId?: string
): Promise<{ status: 'known' | 'new'; session: PublicCustomer }> {
  if (resolveIdentityMode() !== 'otp') {
    throw new HttpError(404, 'Not found');
  }
  const phone = requireMobile(rawPhone);
  const code = String(rawCode ?? '').trim();
  const business = await loadBusiness(slug);
  const challenge = await OtpChallenge.findOne({ businessSlug: business.slug, phone });
  const now = new Date();
  if (!challenge || challenge.expiresAt.getTime() <= now.getTime() || challenge.attempts >= OTP_MAX_ATTEMPTS) {
    throw new ValidationError('Invalid code');
  }
  if (challenge.code !== code) {
    const attempts = challenge.attempts + 1;
    await OtpChallenge.updateOne({ _id: challenge._id }, { $set: { attempts } });
    throw new ValidationError('Invalid code');
  }

  await OtpChallenge.deleteOne({ _id: challenge._id });
  const customer = await findCustomer(business._id, phone);
  const session = await savePublicClientBinding({
    existingSessionId,
    businessId: business._id,
    slug: business.slug,
    phone,
    customerId: customer?._id,
    verified: true,
  });
  return { status: customer ? 'known' : 'new', session };
}

function parseBirthday(value: Birthday | undefined, required: boolean): Birthday | undefined {
  if (!value) {
    if (required) throw new ValidationError('Birthday is required');
    return undefined;
  }
  if (!isRealBirthday(value.day, value.month)) {
    throw new ValidationError('Birthday is not a real date');
  }
  return { day: value.day, month: value.month };
}

export async function completeIdentify(
  session: PublicCustomer,
  input: { name?: string; birthday?: Birthday },
  routeSlug: string
): Promise<void> {
  if (session.slug !== routeSlug) {
    throw new HttpError(403, 'Business mismatch');
  }
  const business = await loadBusiness(session.slug ?? '');
  if (business._id.toString() !== session.businessId) {
    throw new NotFoundError('Business not found');
  }
  const settings = await ensureBusinessSettings(business._id);
  const field = resolveBirthdayField(settings.birthdayField);
  const customer = session.customerId
    ? await Customer.findOne({ _id: session.customerId, businessId: business._id })
    : null;

  if (!customer) {
    const name = input.name?.trim() ?? '';
    if (!name || name.length > 200) throw new ValidationError('Name is required');
    const birthday = field === 'hidden' ? undefined : parseBirthday(input.birthday, field === 'required');
    const created = await Customer.create({
      businessId: business._id,
      name,
      firstName: name.split(/\s+/)[0],
      phone: session.phone,
      ...(birthday ? { birthday } : {}),
    });
    await attachCustomerToSession(session.sessionId, session.businessId, created._id);
    return;
  }

  const missingBirthday = !customer.birthday?.day || !customer.birthday?.month;
  if (field === 'required' && missingBirthday) {
    const birthday = parseBirthday(input.birthday, true);
    customer.birthday = birthday;
  } else if (field === 'optional' && input.birthday) {
    customer.birthday = parseBirthday(input.birthday, false);
  }
  const name = input.name?.trim();
  if (name) {
    if (name.length > 200) throw new ValidationError('Name is required');
    customer.name = name;
    customer.firstName = name.split(/\s+/)[0];
  }
  await customer.save();
}

export async function readSessionProfile(session: PublicCustomer): Promise<{
  verified: boolean;
  needsBirthday: boolean;
  firstName?: string;
}> {
  const settings = await ensureBusinessSettings(session.businessId);
  const field = resolveBirthdayField(settings.birthdayField);
  const customer = session.customerId
    ? await Customer.findOne({ _id: session.customerId, businessId: session.businessId }).lean()
    : null;
  const missing = !customer?.birthday?.day || !customer?.birthday?.month;
  const needsBirthday = field === 'required' && (!customer || missing);
  if (!session.verified || !customer) {
    return { verified: session.verified, needsBirthday };
  }
  return { verified: true, needsBirthday, firstName: firstNameOf(customer) };
}

export async function saveBirthdayField(
  businessId: string,
  next: BirthdayField
): Promise<{ changed: boolean; previous: BirthdayField; current: BirthdayField; settingsId: string }> {
  const settings = await ensureBusinessSettings(businessId);
  const previous = resolveBirthdayField(settings.birthdayField);
  const changed = previous !== next;
  if (changed) {
    settings.birthdayField = next;
    await settings.save();
  }
  return { changed, previous, current: next, settingsId: settings._id.toString() };
}
