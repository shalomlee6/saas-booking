import { AuthRequest } from '../middleware/auth';

/**
 * Resolves the effective businessId from request, considering impersonation.
 * Rules:
 * - If impersonating and impersonatingBusinessId exists -> use that
 * - Super-admin without impersonation -> never return a tenant id (even if JWT had businessId)
 * - Else if req.user.businessId exists -> use that (owners / staff)
 */
export function resolveBusinessIdFromReq(req: AuthRequest): string | undefined {
  if (req.user?.impersonating === true && req.user.impersonatingBusinessId) {
    return req.user.impersonatingBusinessId;
  }

  if (req.user?.role === 'super_admin') {
    return undefined;
  }

  if (req.user?.businessId) {
    return req.user.businessId;
  }

  return undefined;
}





