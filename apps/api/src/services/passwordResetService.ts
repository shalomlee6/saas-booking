import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { PasswordResetToken } from '../models/PasswordResetToken';
import { User } from '../models/User';
import { validateEnv } from '../config/env';
import { isEmailConfigured, sendEmail } from './emailService';
import { logger } from '../utils/logger';

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
export const GENERIC_FORGOT_MESSAGE =
  'If that email exists, a reset link has been sent.';

export function hashResetToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function issuePasswordResetToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(raw);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await PasswordResetToken.updateMany(
    { userId, $or: [{ usedAt: { $exists: false } }, { usedAt: null }] },
    { $set: { usedAt: new Date() } }
  );

  await PasswordResetToken.create({ userId, tokenHash, expiresAt });
  return raw;
}

export function buildResetLink(rawToken: string): string {
  const env = validateEnv();
  const base = env.BASE_URL.replace(/\/$/, '');
  return `${base}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;
}

export async function sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
  const link = buildResetLink(rawToken);
  await sendEmail({
    to,
    subject: 'Reset your Boki password',
    text: `Use this link to reset your password. It expires in 1 hour.\n\n${link}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Use this link to reset your password. It expires in 1 hour.</p><p><a href="${link}">${link}</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
}

/**
 * Sends a reset email when possible. In production, missing SendGrid is a hard error.
 * In development/test the token is stored and the link is logged instead of sent.
 */
export async function deliverPasswordResetEmail(to: string, rawToken: string): Promise<void> {
  if (isEmailConfigured()) {
    await sendPasswordResetEmail(to, rawToken);
    return;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new EmailNotConfiguredError();
  }
  logger.warn('password_reset_email_skipped', {
    reason: 'no_sendgrid',
    to,
    resetLink: buildResetLink(rawToken),
  });
}

export class EmailNotConfiguredError extends Error {
  constructor() {
    super('Email provider is not configured. Set SENDGRID_API_KEY and FROM_EMAIL.');
    this.name = 'EmailNotConfiguredError';
  }
}

export async function consumePasswordResetToken(
  rawToken: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'expired' | 'used' }> {
  const tokenHash = hashResetToken(rawToken);
  const row = await PasswordResetToken.findOne({ tokenHash });
  if (!row) return { ok: false, reason: 'invalid' };
  if (row.usedAt) return { ok: false, reason: 'used' };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: 'expired' };

  const user = await User.findById(row.userId);
  if (!user || user.status === 'disabled') return { ok: false, reason: 'invalid' };

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  row.usedAt = new Date();
  await row.save();

  await PasswordResetToken.updateMany(
    { userId: row.userId, _id: { $ne: row._id }, usedAt: { $exists: false } },
    { $set: { usedAt: new Date() } }
  );

  return { ok: true };
}
