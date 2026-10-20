export type ResolvedIdentityMode = 'otp' | 'phone';

/**
 * How a public client proves who they are: `otp` (SMS code) or `phone` (phone number only, no code).
 * IDENTITY_MODE wins; otherwise production defaults to `phone` and everything else to `otp`.
 * Read on every call so rate limits and routes agree on the mode.
 */
export function resolveIdentityMode(): ResolvedIdentityMode {
  const raw = process.env.IDENTITY_MODE?.trim().toLowerCase();
  if (raw === 'otp' || raw === 'phone') return raw;
  return process.env.NODE_ENV === 'production' ? 'phone' : 'otp';
}
