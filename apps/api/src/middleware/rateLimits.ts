import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { validateEnv } from '../config/env';

const env = validateEnv();
const cfg = env.rateLimit;

/**
 * Buckets by the authenticated caller when a bearer token is present, falling
 * back to IP for anonymous requests. The token's SIGNATURE is verified here
 * (not just decoded) — an unverified decode would let anyone forge a token
 * with a random userId on every request and get a fresh bucket each time,
 * bypassing the limit entirely. A forged/expired/invalid token simply falls
 * through to the IP bucket, same as no token at all.
 */
function keyByUserOrIp(req: Request): string {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.slice(7), env.JWT_SECRET) as
        | { userId?: string; sub?: string; customerId?: string }
        | string;
      if (typeof decoded === 'object') {
        const id = decoded.userId ?? decoded.sub ?? decoded.customerId;
        if (id) return `user:${id}`;
      }
    } catch {
      /* invalid/expired/forged token — fall through to IP */
    }
  }
  return `ip:${req.ip ?? 'unknown'}`;
}

/** OTP is unauthenticated and inherently per-phone-number — bucket on that, not the caller. */
function keyByOtpTarget(req: Request): string {
  const slug = String(req.params?.businessSlug ?? '').trim().toLowerCase();
  const phone = String((req.body as { phone?: unknown } | undefined)?.phone ?? '').replace(/\D/g, '');
  if (phone) return `otp:${slug}:${phone}`;
  return `otp-ip:${req.ip ?? 'unknown'}`;
}

/** Second, IP-only ceiling stacked on top of the per-phone OTP limiter above —
 *  otherwise an attacker can rotate phone numbers to trigger unlimited SMS sends. */
function keyByIp(req: Request): string {
  return `ip:${req.ip ?? 'unknown'}`;
}

/**
 * `standardHeaders: true` already sets the `Retry-After` response header before
 * this runs — read it back rather than re-deriving it, since this express-rate-limit
 * version doesn't type-augment `req.rateLimit`.
 */
function handler(_req: Request, res: Response): void {
  const retryAfterHeader = res.getHeader('Retry-After');
  const retryAfterSeconds =
    typeof retryAfterHeader === 'string' ? Number(retryAfterHeader) : undefined;
  res.status(429).json({
    message: 'Too many requests, please try again later.',
    retryAfter: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
  });
}

const shared = {
  standardHeaders: true as const,
  legacyHeaders: false as const,
  handler,
};

/** Sensitive routes: login, register, password reset. Kept strict even when other tiers are generous. */
export const sensitiveRouteLimiter = rateLimit({
  windowMs: cfg.sensitiveWindowMs,
  max: cfg.maxSensitive,
  keyGenerator: keyByUserOrIp,
  ...shared,
});

/** OTP request/verify — phone-keyed, not user/IP-keyed (unauthenticated by nature). */
export const otpRouteLimiter = rateLimit({
  windowMs: cfg.sensitiveWindowMs,
  max: cfg.maxOtp,
  keyGenerator: keyByOtpTarget,
  ...shared,
});

/** Apply alongside otpRouteLimiter: caps total OTP requests per IP regardless of phone. */
export const otpIpRouteLimiter = rateLimit({
  windowMs: cfg.sensitiveWindowMs,
  max: cfg.maxOtpPerIp,
  keyGenerator: keyByIp,
  ...shared,
});

/** All other `/api/public/*` traffic. */
export const publicRouteLimiter = rateLimit({
  windowMs: cfg.windowMs,
  max: cfg.maxPublic,
  keyGenerator: keyByUserOrIp,
  ...shared,
});

/** Authenticated backoffice routes (business, appointments, customers, etc.) — also covers /api/auth/me and /logout. */
export const apiRouteLimiter = rateLimit({
  windowMs: cfg.windowMs,
  max: cfg.maxApi,
  keyGenerator: keyByUserOrIp,
  ...shared,
});

/** Admin/super-admin routes. */
export const adminRouteLimiter = rateLimit({
  windowMs: cfg.windowMs,
  max: cfg.maxAdmin,
  keyGenerator: keyByUserOrIp,
  ...shared,
});
