import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Business } from '../models/Business';
import { resolveBusinessIdFromReq } from '../utils/resolveBusinessId';
import { normalizeBusinessUi } from '../utils/businessUi';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { logger } from '../utils/logger';

export async function getMe(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const isSuperAdmin = user.role === 'super_admin';
    const isImpersonating = req.user?.impersonating === true;

    // Super-admin: tenant context only while impersonating. Never fall back to user.businessId.
    const effectiveBusinessId = isSuperAdmin
      ? isImpersonating
        ? req.user?.impersonatingBusinessId ?? resolveBusinessIdFromReq(req)
        : undefined
      : resolveBusinessIdFromReq(req) ?? user.businessId?.toString();

    let business: any = null;
    let businessSettings: any = null;

    if (effectiveBusinessId) {
      const businessDoc = await Business.findById(effectiveBusinessId);
      if (!businessDoc && !req.user.impersonating) {
        return res.status(404).json({ message: 'Business not found' });
      }
      // When impersonating, we must return the impersonated business and its settings
      if (businessDoc) {
        const settingsDoc = await ensureBusinessSettings(effectiveBusinessId);
        const owner = await User.findById(businessDoc.ownerId).lean();
        business = {
          _id: businessDoc._id.toString(),
          name: businessDoc.name,
          slug: businessDoc.slug,
          ui: normalizeBusinessUi(businessDoc.ui),
          ownerEmail: owner?.email ?? null,
        };
        businessSettings = {
          theme: settingsDoc.theme
            ? {
                colors: settingsDoc.theme.colors,
                logoUrl: settingsDoc.theme.logoUrl,
                fontFamily: settingsDoc.theme.fontFamily,
              }
            : null,
          // Expose timezone so the frontend calendar can render in the business locale.
          localization: {
            timezone: settingsDoc.localization?.timezone ?? 'Asia/Jerusalem',
          },
        };
      }
    }

    const responseBusinessId =
      isSuperAdmin && !isImpersonating
        ? undefined
        : effectiveBusinessId?.toString() || user.businessId?.toString();

    return res.json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        businessId: responseBusinessId,
        businessSlug: business?.slug?.toString(),
      },
      business: business || null,
      businessSettings: businessSettings || null,
      role: user.role,
    });
  } catch (err) {
    logger.error('get_auth_me_failed', { error: err instanceof Error ? err.message : String(err) });
    return res.status(500).json({ message: 'Internal server error' });
  }
}

