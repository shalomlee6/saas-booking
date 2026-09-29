import type { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Types } from 'mongoose';
import { validateEnv } from '../config/env';

export const STAFF_COOKIE_NAME = 'sb_token';
export const STAFF_SESSION_TTL = '90d';
export const STAFF_SESSION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
export const IMPERSONATION_TTL = '30m';
export const REFRESHED_STAFF_TOKEN_HEADER = 'X-Refreshed-Token';

export function staffAuthCookieOptions(): CookieOptions {
  return {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: STAFF_SESSION_MAX_AGE_MS,
  };
}

export function clearStaffAuthCookieOptions(): CookieOptions {
  return {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };
}

/**
 * The actor a staff-flavored JWT is issued for — always the REAL person
 * behind the token, never whoever/whatever they're currently acting on
 * (e.g. an impersonation token's actor is the super-admin, not the business
 * being impersonated). `passwordChangedAt` must be that same actor's own
 * current value: every token carries it as the `pwv` claim, which
 * `middleware/auth.ts` checks against the live User document on every
 * request, rejecting anything issued before the actor's latest password
 * change. Passing `passwordChangedAt` here (rather than each call site
 * poking `pwv` onto a payload by hand) is what makes it impossible for a new
 * token-issuing path to forget it — see signStaffToken below.
 */
export interface StaffTokenActor {
  userId: string | Types.ObjectId;
  role: string;
  email?: string;
  businessId?: string | Types.ObjectId | null;
  passwordChangedAt?: Date | null;
}

function buildStaffPayload(actor: StaffTokenActor, extra?: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    userId: String(actor.userId),
    role: actor.role,
    email: actor.email,
  };
  // Super-admin session must not carry tenant scope; impersonation carries it explicitly instead.
  if (actor.role !== 'super_admin' && actor.businessId) {
    payload.businessId = String(actor.businessId);
  }
  if (actor.passwordChangedAt) {
    payload.pwv = actor.passwordChangedAt.getTime();
  }
  return extra ? { ...payload, ...extra } : payload;
}

/**
 * The single place every staff-flavored JWT in this app is minted —
 * login, register, change-password's own re-issue, the sliding refresh on
 * each request, and impersonation (start). Nothing else should call
 * `jwt.sign` for a staff/admin session directly: routing every issuer
 * through here is what guarantees `pwv` (and the businessId-scoping rule)
 * can never be forgotten by a new call site.
 */
export function signStaffToken(actor: StaffTokenActor, extra?: Record<string, unknown>): string {
  const env = validateEnv();
  const ttl = typeof extra?.impersonating === 'boolean' && extra.impersonating ? IMPERSONATION_TTL : STAFF_SESSION_TTL;
  return jwt.sign(buildStaffPayload(actor, extra), env.JWT_SECRET, { expiresIn: ttl });
}

/** @deprecated use signStaffToken — kept only so any stray external caller doesn't break. */
export function signStaffSessionToken(actor: StaffTokenActor): string {
  return signStaffToken(actor);
}

/**
 * Impersonation token — always carries the acting super-admin's OWN `userId`
 * and `pwv`, never the impersonated business owner's. This is a deliberate
 * choice: the token identifies who is really making the request (for audit,
 * for the "exit impersonation" flow, for every permission check), so it must
 * be invalidated by *that person's* password changing, not the tenant's —
 * and symmetrically, the owner changing their own password must never break
 * an admin's already-running impersonation session.
 */
export function signImpersonationToken(admin: StaffTokenActor, impersonatingBusinessId: string): string {
  return signStaffToken(admin, { impersonating: true, impersonatingBusinessId });
}

/**
 * Re-issues a staff JWT + cookie after a successful auth check.
 * Impersonation tokens keep their short fixed expiry and are not renewed.
 */
export function maybeRenewStaffSession(
  res: Response,
  user: { userId: string; role: string; email?: string; businessId?: string },
  decoded: Record<string, unknown>,
  passwordChangedAt?: Date | null
): void {
  if (decoded.impersonating === true) return;

  const token = signStaffToken({ ...user, passwordChangedAt });
  res.cookie(STAFF_COOKIE_NAME, token, staffAuthCookieOptions());
  res.setHeader(REFRESHED_STAFF_TOKEN_HEADER, token);
}
