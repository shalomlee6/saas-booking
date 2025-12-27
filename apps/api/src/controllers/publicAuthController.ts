import { Request, Response } from 'express';
import { Business } from '../models/Business';
import { Customer } from '../models/Customer';
import jwt from 'jsonwebtoken';

// In-memory OTP storage (dev only)
// In production, use Redis or similar
const otpStore = new Map<string, { code: string; expiresAt: number }>();
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const DEV_OTP_CODE = '123456';

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
  // Use IP + phone for rate limiting
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const phone = (req.body.phone || '').toString();
  return `${ip}:${phone}`;
}

// POST /api/public/:businessSlug/auth/request-otp
export async function requestOtp(req: Request, res: Response) {
  try {
    const { businessSlug } = req.params;
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: 'phone is required' });
    }

    // Rate limiting
    const identifier = getClientIdentifier(req);
    if (!checkRateLimit(identifier)) {
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }

    // Resolve business
    const business = await Business.findOne({ slug: businessSlug });
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    // In dev: always accept, store a dummy OTP
    // In production: generate real OTP and send via SMS
    const otpCode = DEV_OTP_CODE;
    const expiresAt = Date.now() + OTP_EXPIRY_MS;

    otpStore.set(`${businessSlug}:${phone}`, { code: otpCode, expiresAt });

    // Simulate SMS send delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return res.json({ ok: true });
  } catch (err) {
    console.error('Error POST /public/:businessSlug/auth/request-otp:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /api/public/:businessSlug/auth/verify-otp
export async function verifyOtp(req: Request, res: Response) {
  try {
    const { businessSlug } = req.params;
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ message: 'phone and code are required' });
    }

    // Rate limiting
    const identifier = getClientIdentifier(req);
    if (!checkRateLimit(identifier)) {
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }

    // Resolve business
    const business = await Business.findOne({ slug: businessSlug });
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    const businessId = business._id.toString();

    // Check OTP
    const stored = otpStore.get(`${businessSlug}:${phone}`);
    
    // In dev: always accept "123456"
    const isValid = code === DEV_OTP_CODE || (stored && stored.code === code && Date.now() < stored.expiresAt);

    if (!isValid) {
      return res.status(401).json({ message: 'Invalid or expired code' });
    }

    // Clean up OTP
    otpStore.delete(`${businessSlug}:${phone}`);

    // Find or create customer
    let customer = await Customer.findOne({ phone, businessId: business._id });

    if (!customer) {
      // Create customer with phone only (name can be updated later)
      customer = await Customer.create({
        businessId: business._id,
        name: phone, // Placeholder name
        phone,
      });
    }

    // Generate JWT token for client
    const token = jwt.sign(
      {
        customerId: customer._id.toString(),
        businessId,
        role: 'client',
      },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '30d' }
    );

    return res.json({
      token,
      customerId: customer._id.toString(),
      businessId,
    });
  } catch (err) {
    console.error('Error POST /public/:businessSlug/auth/verify-otp:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

