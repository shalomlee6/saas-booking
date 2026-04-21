/**
 * Read JWT `exp` (seconds since epoch) from an encoded token without verifying
 * the signature. Used only for client-side session hints; authorization remains
 * enforced by the httpOnly cookie + server.
 */
export function decodeJwtExpMs(token: string): number | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = parts[1];
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
    if (typeof atob === 'undefined') return null;
    const json = atob(padded);
    const data = JSON.parse(json) as { exp?: number };
    if (typeof data.exp !== 'number' || !Number.isFinite(data.exp)) return null;
    return data.exp * 1000;
  } catch {
    return null;
  }
}
