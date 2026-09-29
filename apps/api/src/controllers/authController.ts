import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Business } from '../models/Business';
import { resolveBusinessIdFromReq } from '../utils/resolveBusinessId';
import { normalizeBusinessUi } from '../utils/businessUi';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { recordAudit } from '../utils/recordAudit';
import { maybeRenewStaffSession } from '../utils/staffSession';
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
      // Also applies while impersonating: a token whose impersonated business
      // was deleted must fail here rather than silently returning `business:
      // null` with a 200 — the frontend treats a failed /me as "not logged
      // in" and drops the stale impersonation token (see auth.service.ts).
      if (!businessDoc) {
        return res.status(404).json({ message: 'Business not found' });
      }
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
              preset: settingsDoc.theme.preset,
              defaultMode: settingsDoc.theme.defaultMode,
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

/** POST /api/auth/change-password — self-service, requires the current password. */
export async function changePassword(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }
    if (currentPassword === newPassword) {
      return res
        .status(400)
        .json({ message: 'New password must be different from the current password.' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordChangedAt = new Date();
    await user.save();

    await recordAudit({
      actorUserId: req.user.userId,
      actorEmail: req.user.email,
      action: 'user.password_changed',
      entity: 'User',
      entityId: user._id.toString(),
      metadata: {},
    });

    // Re-issue a fresh session carrying the new password version so this request's
    // own session stays logged in — every other outstanding token (which lacks
    // it) is rejected on its next request. See middleware/auth.ts.
    maybeRenewStaffSession(
      res,
      {
        userId: req.user.userId,
        role: req.user.role,
        email: req.user.email,
        businessId: req.user.businessId,
      },
      { impersonating: req.user.impersonating === true },
      user.passwordChangedAt
    );

    return res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    logger.error('change_password_failed', { error: err instanceof Error ? err.message : String(err) });
    return res.status(500).json({ message: 'Internal server error' });
  }
}

