import { Request, Response } from 'express';
import { Business } from '../models/Business';
import { Customer } from '../models/Customer';
import jwt from 'jsonwebtoken';
import { validateEnv } from '../config/env';
import type { RequestWithPublicCustomer } from '../types/publicCustomer';
import { setPublicCustomerSessionCookie } from '../utils/publicCustomerSession';
import { logger } from '../utils/logger';

// In-memory OTP storage (dev only)
// In production, use Redis or similar
const otpStore = new Map<string, { code: string; expiresAt: number; firstName?: string; lastName?: string }>();
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const DEV_OTP_CODE = '123456';

function isDevOtpBypassEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.PUBLIC_DEV_OTP_BYPASS === 'true';
}

/** Digits-only phone for consistent store keys and customer lookup. */
function normalizePhone(phone: unknown): string {
  if (phone == null) return '';
  return String(phone).replace(/\D/g, '');
}

function normalizeBusinessSlug(slug: string): string {
  return slug.trim();
}

function otpStoreKey(businessSlug: string, phone: unknown): string {
  return `${normalizeBusinessSlug(businessSlug)}:${normalizePhone(phone)}`;
}

function normalizeOtpCode(code: unknown): string {
  return String(code ?? '').trim();
}

// Rate limiting (simple in-memory)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5;

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count++;
  return true;
}

function getClientIdentifier(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const phone = normalizePhone(req.body?.phone);
  return `${ip}:${phone}`;
}

// POST /api/public/:businessSlug/auth/request-otp
export async function requestOtp(req: Request, res: Response) {
  try {
    const businessSlug = normalizeBusinessSlug(String(req.params.businessSlug ?? ''));
    const { phone, firstName, lastName } = req.body as {
      phone?: unknown;
      firstName?: string;
      lastName?: string;
    };
    const normalizedPhone = normalizePhone(phone);

    logger.info('OTP_REQUEST', {
      businessSlug,
      phoneRaw: phone,
      phoneNormalized: normalizedPhone,
      devBypass: isDevOtpBypassEnabled(),
    });

    if (!normalizedPhone) {
      return res.status(400).json({ message: 'phone is required' });
    }

    const identifier = getClientIdentifier(req);
    if (!checkRateLimit(identifier)) {
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }

    const business = await Business.findOne({ slug: businessSlug });
    if (!business) {
      logger.info('OTP_FAILURE', { stage: 'request', reason: 'business_not_found', businessSlug });
      return res.status(404).json({ message: 'Business not found' });
    }

    const otpCode = isDevOtpBypassEnabled()
      ? DEV_OTP_CODE
      : String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + OTP_EXPIRY_MS;
    const storeKey = otpStoreKey(businessSlug, normalizedPhone);

    otpStore.set(storeKey, {
      code: otpCode,
      expiresAt,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
    });

    logger.info('OTP_STORED', {
      storeKey,
      expiresAt,
      codeLength: otpCode.length,
      devBypass: isDevOtpBypassEnabled(),
    });

    return res.json({ ok: true });
  } catch (err) {
    logger.error('public_request_otp_failed', { error: err instanceof Error ? err.message : String(err) });
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /api/public/:businessSlug/auth/verify-otp
export async function verifyOtp(req: Request, res: Response) {
  try {
    const businessSlug = normalizeBusinessSlug(String(req.params.businessSlug ?? ''));
    const { phone, code } = req.body as { phone?: unknown; code?: unknown };
    const normalizedPhone = normalizePhone(phone);
    const normalizedCode = normalizeOtpCode(code);
    const storeKey = otpStoreKey(businessSlug, normalizedPhone);

    logger.info('OTP_VERIFY', {
      businessSlug,
      phoneRaw: phone,
      phoneNormalized: normalizedPhone,
      codeLength: normalizedCode.length,
      storeKey,
      devBypass: isDevOtpBypassEnabled(),
    });

    if (!normalizedPhone || !normalizedCode) {
      return res.status(400).json({ message: 'phone and code are required' });
    }

    const identifier = getClientIdentifier(req);
    if (!checkRateLimit(identifier)) {
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }

    const business = await Business.findOne({ slug: businessSlug });
    if (!business) {
      logger.info('OTP_FAILURE', { stage: 'verify', reason: 'business_not_found', businessSlug });
      return res.status(404).json({ message: 'Business not found' });
    }

    const businessId = business._id.toString();
    const stored = otpStore.get(storeKey);
    const now = Date.now();

    logger.info('OTP_FOUND', {
      storeKey,
      found: !!stored,
      expired: stored ? now >= stored.expiresAt : undefined,
    });

    let isValid =
      !!stored && stored.code === normalizedCode && now < stored.expiresAt;

    logger.info('OTP_COMPARE', {
      storeKey,
      match: stored ? stored.code === normalizedCode : false,
      expired: stored ? now >= stored.expiresAt : undefined,
    });

    // Dev bypass: accept demo code even if store was lost (e.g. server restart) or never requested.
    if (!isValid && isDevOtpBypassEnabled() && normalizedCode === DEV_OTP_CODE) {
      logger.info('OTP_DEV_BYPASS', { storeKey });
      isValid = true;
    }

    if (!isValid) {
      logger.info('OTP_FAILURE', {
        storeKey,
        reason: !stored ? 'not_found' : now >= (stored?.expiresAt ?? 0) ? 'expired' : 'code_mismatch',
      });
      return res.status(401).json({ message: 'Invalid or expired code' });
    }

    const firstName = stored?.firstName;
    const lastName = stored?.lastName;

    if (stored) {
      otpStore.delete(storeKey);
    }

    let customer = await Customer.findOne({ phone: normalizedPhone, businessId: business._id });

    if (!customer) {
      const customerName =
        firstName && lastName
          ? `${firstName} ${lastName}`.trim()
          : firstName || lastName || normalizedPhone;

      customer = await Customer.create({
        businessId: business._id,
        name: customerName,
        phone: normalizedPhone,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      });
    } else if (firstName || lastName) {
      const customerName =
        firstName && lastName
          ? `${firstName} ${lastName}`.trim()
          : firstName || lastName || customer.name;

      customer.name = customerName;
      if (firstName) customer.firstName = firstName;
      if (lastName) customer.lastName = lastName;
      await customer.save();
    }

    const env = validateEnv();
    const token = jwt.sign(
      {
        sub: customer._id.toString(),
        customerId: customer._id.toString(),
        businessId,
        slug: businessSlug,
        role: 'customer',
      },
      env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    setPublicCustomerSessionCookie(res, token);

    logger.info('OTP_SUCCESS', {
      storeKey,
      customerId: customer._id.toString(),
      businessId,
    });

    return res.json({
      token,
      customerId: customer._id.toString(),
      businessId,
      customerName: customer.name ?? undefined,
      customerPhone: customer.phone ?? undefined,
    });
  } catch (err) {
    logger.error('public_verify_otp_failed', { error: err instanceof Error ? err.message : String(err) });
    return res.status(500).json({ message: 'Internal server error' });
  }
}

/** GET /api/public/auth/me — session from Bearer or HTTP-only cookie */
export async function getPublicAuthMe(req: RequestWithPublicCustomer, res: Response): Promise<void> {
  const pc = req.publicCustomer!;
  const customer = await Customer.findOne({
    _id: pc.customerId,
    businessId: pc.businessId,
  }).lean();

  if (!customer) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  res.json({
    id: customer._id.toString(),
    businessId: String(customer.businessId),
    slug: pc.slug,
    name: customer.name,
    firstName: customer.firstName ?? undefined,
    lastName: customer.lastName ?? undefined,
    phone: customer.phone,
    email: customer.email ?? undefined,
  });
}
