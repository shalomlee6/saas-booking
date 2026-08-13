import { logger } from '../utils/logger';

export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_FROM_NUMBER?.trim()
  );
}

/**
 * Convert a digits-only Israeli (or already-international) phone to E.164.
 * Returns null when the number cannot be converted.
 */
export function toE164(digitsOnly: string): string | null {
  const d = digitsOnly.replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('972') && d.length >= 11) return `+${d}`;
  if (d.startsWith('0') && d.length >= 9) return `+972${d.slice(1)}`;
  if (d.length === 9) return `+972${d}`;
  if (d.length >= 10 && d.length <= 15) return `+${d}`;
  return null;
}

export async function sendOtpSms(toE164: string, code: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();
  if (!sid || !token || !from) {
    throw new Error('Twilio is not configured');
  }

  const body = new URLSearchParams({
    To: toE164,
    From: from,
    Body: `קוד האימות שלך: ${code}`,
  });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.error('twilio_sms_failed', { status: res.status, body: text.slice(0, 500) });
    throw new Error(`Twilio SMS failed: ${res.status}`);
  }
}
