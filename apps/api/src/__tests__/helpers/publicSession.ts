import type { Application } from 'express';
import request from 'supertest';
import { canonicalLocalPhone } from '../../listQuery/search';
import { OtpChallenge } from '../../models/OtpChallenge';

export const PUBLIC_SESSION_COOKIE = 'sb_public_customer';

export function publicCookieHeader(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const lines = Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' ? [raw] : [];
  const found = lines.find((line) => line.startsWith(`${PUBLIC_SESSION_COOKIE}=`));
  if (!found) throw new Error('missing session cookie');
  return found.split(';')[0];
}

export function publicSessionId(cookie: string): string {
  return decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1));
}

/**
 * Opens a public session for one business.
 * OTP mode: identify/start then identify/verify. The session id is only on the cookie.
 * Phone mode: identify/start already sets the unverified cookie.
 * When the phone is new and `profile.name` is set, identify/complete stores the customer.
 */
export async function loginPublicClient(
  app: Application,
  slug: string,
  phone: string,
  profile?: { name: string }
): Promise<{ cookie: string; sessionId: string }> {
  const canonical = canonicalLocalPhone(phone);
  if (!canonical) throw new Error(`not a mobile: ${phone}`);

  const start = await request(app)
    .post(`/api/public/businesses/${slug}/identify/start`)
    .send({ phone });
  if (start.status !== 200) {
    throw new Error(`identify start ${start.status} ${JSON.stringify(start.body)}`);
  }
  if (start.body.status === 'blocked') {
    throw new Error('identify start blocked');
  }

  let cookie: string;
  if (start.body.status === 'known' || start.body.status === 'new') {
    cookie = publicCookieHeader(start);
  } else {
    const stored = await OtpChallenge.findOne({ businessSlug: slug, phone: canonical });
    const verify = await request(app)
      .post(`/api/public/businesses/${slug}/identify/verify`)
      .send({ phone: canonical, code: stored?.code });
    if (verify.status !== 200) {
      throw new Error(`identify verify ${verify.status} ${JSON.stringify(verify.body)}`);
    }
    cookie = publicCookieHeader(verify);
    if (profile?.name && verify.body.status === 'new') {
      const complete = await request(app)
        .post(`/api/public/businesses/${slug}/identify/complete`)
        .set('Cookie', cookie)
        .send({ name: profile.name, birthday: { day: 1, month: 1 } });
      if (complete.status !== 200) {
        throw new Error(`identify complete ${complete.status} ${JSON.stringify(complete.body)}`);
      }
    }
  }

  return { cookie, sessionId: publicSessionId(cookie) };
}
