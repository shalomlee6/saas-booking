import type { CookieOptions, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { validateEnv } from '../config/env';
import type { PublicCustomer } from '../types/publicCustomer';

export const PUBLIC_CUSTOMER_COOKIE_NAME = 'sb_public_customer';
export const CUSTOMER_SESSION_TTL = '365d';
export const CUSTOMER_SESSION_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
export const REFRESHED_PUBLIC_TOKEN_HEADER = 'X-Refreshed-Public-Token';

export function publicCustomerCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: CUSTOMER_SESSION_MAX_AGE_MS,
    path: '/api/public',
  };
}

/** Bearer wins over cookie (matches staff auth precedence). */
export function getPublicCustomerJwtFromRequest(req: Request): string | undefined {
  const header = req.headers['authorization'];
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    const t = header.slice(7).trim();
    if (t) return t;
  }
  const fromCookie = req.cookies?.[PUBLIC_CUSTOMER_COOKIE_NAME];
  if (typeof fromCookie === 'string' && fromCookie.trim()) {
    return fromCookie.trim();
  }
  return undefined;
}

export function verifyPublicCustomerJwt(token: string): PublicCustomer | null {
  try {
    const env = validateEnv();
    const decoded = jwt.verify(token, env.JWT_SECRET) as Record<string, unknown>;
    if (String(decoded.role) !== 'customer') return null;
    const customerId = decoded.customerId != null ? String(decoded.customerId) : null;
    const businessId = decoded.businessId != null ? String(decoded.businessId) : null;
    if (!customerId || !businessId) return null;
    return {
      customerId,
      businessId,
      slug: decoded.slug != null ? String(decoded.slug) : undefined,
    };
  } catch {
    return null;
  }
}

export function setPublicCustomerSessionCookie(res: Response, token: string): void {
  res.cookie(PUBLIC_CUSTOMER_COOKIE_NAME, token, publicCustomerCookieOptions());
}

/** JWT used by public customer OTP login and guest booking. */
export function signPublicCustomerToken(args: {
  customerId: string;
  businessId: string;
  slug: string;
}): string {
  const env = validateEnv();
  return jwt.sign(
    {
      sub: args.customerId,
      customerId: args.customerId,
      businessId: args.businessId,
      slug: args.slug,
      role: 'customer',
    },
    env.JWT_SECRET,
    { expiresIn: CUSTOMER_SESSION_TTL }
  );
}

/** Re-issues the public customer JWT + cookie after a successful session check. */
export function renewPublicCustomerSession(res: Response, session: PublicCustomer): string {
  const token = signPublicCustomerToken({
    customerId: session.customerId,
    businessId: session.businessId,
    slug: session.slug ?? '',
  });
  setPublicCustomerSessionCookie(res, token);
  res.setHeader(REFRESHED_PUBLIC_TOKEN_HEADER, token);
  return token;
}
