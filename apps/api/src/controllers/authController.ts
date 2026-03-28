import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Business } from '../models/Business';
import { resolveBusinessIdFromReq } from '../utils/resolveBusinessId';
import { normalizeBusinessUi } from '../utils/businessUi';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';

export async function getMe(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // When impersonating, use impersonatingBusinessId; else use user's businessId
    const effectiveBusinessId = resolveBusinessIdFromReq(req) ?? user.businessId?.toString();

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

    return res.json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        businessId: effectiveBusinessId?.toString() || user.businessId?.toString(),
        businessSlug: business?.slug?.toString(),
      },
      business: business || null,
      businessSettings: businessSettings || null,
      role: user.role,
    });
  } catch (err) {
    console.error('Error GET /auth/me:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

