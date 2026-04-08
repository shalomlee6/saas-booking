import type { AuthRequest } from '../middleware/auth';
import { resolveBusinessIdFromReq } from './resolveBusinessId';

/**
 * Returns tenant id after `requireBusinessContext` has run, otherwise falls back
 * to JWT / impersonation fields only (no DB lookup).
 */
export function getEffectiveBusinessId(req: AuthRequest): string | undefined {
  return req.effectiveBusinessId ?? resolveBusinessIdFromReq(req);
}
