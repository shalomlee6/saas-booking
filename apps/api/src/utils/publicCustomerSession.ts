import { randomBytes } from 'crypto';
import type { CookieOptions, Request, Response } from 'express';
import { Types } from 'mongoose';
import { PublicClientSession, type IPublicClientBinding } from '../models/PublicClientSession';
import type { PublicCustomer } from '../types/publicCustomer';

export const PUBLIC_CUSTOMER_COOKIE_NAME = 'sb_public_customer';
export const PUBLIC_SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export interface PublicBusinessHint {
  businessId?: string;
  slug?: string;
}

export function publicCustomerCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: PUBLIC_SESSION_TTL_MS,
    path: '/api/public',
  };
}

export function clearPublicCustomerCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/public',
  };
}

/**
 * The business a public request is about. Booking and availability name it in
 * the body or query; identify and slug routes name it in the path.
 */
export function publicBusinessHint(req: Request): PublicBusinessHint {
  const params = req.params ?? {};
  const query = req.query ?? {};
  const body = (req.body ?? {}) as { businessId?: unknown; slug?: unknown };
  const slug = [params.slug, params.businessSlug, query.slug, body.slug].find(
    (value) => typeof value === 'string' && value.trim().length > 0
  );
  const businessId = [query.businessId, body.businessId].find(
    (value) => typeof value === 'string' && value.trim().length > 0
  );
  return {
    ...(typeof slug === 'string' ? { slug: slug.trim() } : {}),
    ...(typeof businessId === 'string' ? { businessId: businessId.trim() } : {}),
  };
}

export function readPublicSessionId(req: Request): string | undefined {
  const fromCookie = req.cookies?.[PUBLIC_CUSTOMER_COOKIE_NAME];
  if (typeof fromCookie === 'string' && fromCookie.trim() && !fromCookie.includes('.')) {
    return fromCookie.trim();
  }
  return undefined;
}

export function setPublicSessionCookie(res: Response, sessionId: string): void {
  res.cookie(PUBLIC_CUSTOMER_COOKIE_NAME, sessionId, publicCustomerCookieOptions());
}

export function clearPublicSessionCookie(res: Response): void {
  res.clearCookie(PUBLIC_CUSTOMER_COOKIE_NAME, clearPublicCustomerCookieOptions());
}

function toPublicCustomer(sessionId: string, binding: IPublicClientBinding): PublicCustomer {
  return {
    sessionId,
    businessId: binding.businessId.toString(),
    slug: binding.slug,
    phone: binding.phone,
    verified: binding.verified,
    ...(binding.customerId ? { customerId: binding.customerId.toString() } : {}),
  };
}

function selectBinding(
  bindings: IPublicClientBinding[],
  hint?: PublicBusinessHint
): IPublicClientBinding | null {
  let matches = bindings;
  if (hint?.businessId) {
    matches = matches.filter((binding) => binding.businessId.toString() === hint.businessId);
  }
  if (hint?.slug) {
    matches = matches.filter((binding) => binding.slug === hint.slug);
  }
  if (hint?.businessId || hint?.slug) return matches[0] ?? null;
  if (bindings.length === 1) return bindings[0];
  return null;
}

export async function savePublicClientBinding(input: {
  existingSessionId?: string;
  businessId: Types.ObjectId;
  slug: string;
  phone: string;
  customerId?: Types.ObjectId;
  verified: boolean;
}): Promise<PublicCustomer> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PUBLIC_SESSION_TTL_MS);
  if (input.existingSessionId) {
    const row = await PublicClientSession.findOne({
      sessionId: input.existingSessionId,
      revokedAt: { $exists: false },
      expiresAt: { $gt: now },
    });
    if (row) {
      const current = row.bindings.find(
        (binding) => binding.businessId.toString() === input.businessId.toString()
      );
      if (current) {
        current.slug = input.slug;
        current.phone = input.phone;
        if (input.customerId) current.customerId = input.customerId;
        current.verified = current.verified || input.verified;
      } else {
        row.bindings.push({
          businessId: input.businessId,
          slug: input.slug,
          phone: input.phone,
          customerId: input.customerId,
          verified: input.verified,
        });
      }
      row.expiresAt = expiresAt;
      await row.save();
      const saved = row.bindings.find(
        (binding) => binding.businessId.toString() === input.businessId.toString()
      );
      return toPublicCustomer(row.sessionId, saved!);
    }
  }

  const sessionId = randomBytes(32).toString('hex');
  const binding: IPublicClientBinding = {
    businessId: input.businessId,
    slug: input.slug,
    phone: input.phone,
    customerId: input.customerId,
    verified: input.verified,
  };
  await PublicClientSession.create({
    sessionId,
    bindings: [binding],
    expiresAt,
  });
  return toPublicCustomer(sessionId, binding);
}

/**
 * Loads a live device session, slides its expiry, and returns the binding for
 * the requested business. A session that only knows business A is not a
 * session for business B.
 */
export async function renewPublicClientSession(
  sessionId: string,
  hint?: PublicBusinessHint
): Promise<PublicCustomer | null> {
  const now = new Date();
  const row = await PublicClientSession.findOneAndUpdate(
    {
      sessionId,
      revokedAt: { $exists: false },
      expiresAt: { $gt: now },
    },
    { $set: { expiresAt: new Date(now.getTime() + PUBLIC_SESSION_TTL_MS) } },
    { new: true }
  );
  if (!row) return null;
  const binding = selectBinding(row.bindings, hint);
  if (!binding) return null;
  return toPublicCustomer(row.sessionId, binding);
}

/**
 * Drops one business binding when `slug` is set, and leaves the others.
 * Without a slug, or when the last binding is removed, the device session is revoked.
 */
export async function revokePublicClientSession(sessionId: string, slug?: string): Promise<'cleared' | 'kept'> {
  const row = await PublicClientSession.findOne({ sessionId, revokedAt: { $exists: false } });
  if (!row) return 'cleared';
  if (slug) {
    row.bindings = row.bindings.filter((binding) => binding.slug !== slug);
  } else {
    row.bindings = [];
  }
  if (row.bindings.length === 0) {
    row.revokedAt = new Date();
    await row.save();
    return 'cleared';
  }
  await row.save();
  return 'kept';
}

export async function attachCustomerToSession(
  sessionId: string,
  businessId: string,
  customerId: Types.ObjectId
): Promise<void> {
  await PublicClientSession.updateOne(
    { sessionId, 'bindings.businessId': new Types.ObjectId(businessId) },
    { $set: { 'bindings.$.customerId': customerId } }
  );
}
