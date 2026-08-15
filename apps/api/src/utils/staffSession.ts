import type { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';
import { validateEnv } from '../config/env';

export const STAFF_COOKIE_NAME = 'sb_token';
export const STAFF_SESSION_TTL = '90d';
export const STAFF_SESSION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
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

export function signStaffSessionToken(payload: Record<string, unknown>): string {
  const env = validateEnv();
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: STAFF_SESSION_TTL });
}

/**
 * Re-issues a staff JWT + cookie after a successful auth check.
 * Impersonation tokens keep their short fixed expiry and are not renewed.
 */
export function maybeRenewStaffSession(
  res: Response,
  user: { userId: string; role: string; email?: string; businessId?: string },
  decoded: Record<string, unknown>
): void {
  if (decoded.impersonating === true) return;

  const payload: Record<string, unknown> = {
    userId: user.userId,
    role: user.role,
    email: user.email,
  };
  if (user.role !== 'super_admin' && user.businessId) {
    payload.businessId = user.businessId;
  }

  const token = signStaffSessionToken(payload);
  res.cookie(STAFF_COOKIE_NAME, token, staffAuthCookieOptions());
  res.setHeader(REFRESHED_STAFF_TOKEN_HEADER, token);
}
