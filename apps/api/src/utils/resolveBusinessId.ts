import { AuthRequest } from '../middleware/auth';

/**
 * Resolves the effective businessId from request, considering impersonation.
 * Rules:
 * - If impersonating and impersonatingBusinessId exists -> use that
 * - Else if req.user.businessId exists -> use that
 * - Else undefined
 */
export function resolveBusinessIdFromReq(req: AuthRequest): string | undefined {
  if (req.user?.impersonating === true && req.user.impersonatingBusinessId) {
    return req.user.impersonatingBusinessId;
  }

  if (req.user?.businessId) {
    return req.user.businessId;
  }

  return undefined;
}





