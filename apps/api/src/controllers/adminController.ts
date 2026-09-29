import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { Business } from '../models/Business';
import { User } from '../models/User';
import { BusinessSettings } from '../models/BusinessSettings';
import { Service } from '../models/Service';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { normalizeBusinessUi, validateBusinessUiBody } from '../utils/businessUi';
import { recordAudit } from '../utils/recordAudit';
import { provisionTenant } from '../utils/provisionTenant';
import { signImpersonationToken } from '../utils/staffSession';
import { VALID_THEME_PRESET_IDS, isValidThemePresetId } from '../utils/themePresets';
import { logger } from '../utils/logger';
import type { PlanTier } from '../utils/planPolicy';

// GET /api/admin/businesses
export async function getAdminBusinesses(req: AuthRequest, res: Response): Promise<void> {
  try {
    const businesses = await Business.find({}).sort({ createdAt: -1 }).lean();

    const businessesWithOwner = await Promise.all(
      businesses.map(async (business) => {
        const owner = await User.findById(business.ownerId).lean();
        const settings = await ensureBusinessSettings(business._id);
        return {
          _id: business._id.toString(),
          name: business.name,
          slug: business.slug,
          ownerEmail: owner?.email ?? null,
          ownerPhone: owner?.phone ?? null,
          createdAt: business.createdAt,
          updatedAt: business.updatedAt,
          ui: normalizeBusinessUi(business.ui),
          settings: {
            plan: settings.plan,
            theme: {
              colors: {
                primary: settings.theme.colors.primary,
              },
              preset: settings.theme.preset,
              defaultMode: settings.theme.defaultMode,
            },
            features: {
              bookingEnabled: settings.features.bookingEnabled,
            },
          },
        };
      })
    );

    res.json(businessesWithOwner);
  } catch (err) {
    logger.error('get_admin_businesses_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /api/admin/businesses — body validated by createAdminBusinessBodySchema
export async function createAdminBusiness(req: AuthRequest, res: Response): Promise<void> {
  try {
    const body = req.body as {
      businessName: string;
      ownerFullName: string;
      ownerEmail: string;
      ownerPhone?: string;
      plan: PlanTier;
      timezone: string;
      businessSlug?: string;
      ownerPassword?: string;
    };

    const result = await provisionTenant({
      businessName: body.businessName,
      ownerFullName: body.ownerFullName,
      ownerEmail: body.ownerEmail,
      ownerPhone: body.ownerPhone?.trim() || undefined,
      plan: body.plan,
      timezone: body.timezone,
      businessSlug: body.businessSlug,
      ownerPassword: body.ownerPassword,
    });

    await recordAudit({
      actorUserId: req.user?.userId,
      actorEmail: req.user?.email,
      action: 'business.provision',
      entity: 'Business',
      entityId: result.businessId.toString(),
      metadata: { ownerEmail: body.ownerEmail, plan: body.plan },
    });

    const [business, owner, settings, defaultService] = await Promise.all([
      Business.findById(result.businessId).lean(),
      User.findById(result.ownerId).lean(),
      BusinessSettings.findById(result.settingsId).lean(),
      Service.findById(result.serviceId).lean(),
    ]);

    res.status(201).json({
      business:
        business &&
        ({
          _id: business._id.toString(),
          name: business.name,
          slug: business.slug,
          plan: business.plan,
          phone: business.phone ?? null,
          ownerId: business.ownerId.toString(),
          createdAt: business.createdAt,
          updatedAt: business.updatedAt,
        } as const),
      owner:
        owner &&
        ({
          id: owner._id.toString(),
          email: owner.email,
          name: owner.name ?? '',
          phone: owner.phone ?? null,
          role: owner.role,
          status: owner.status,
          businessId: owner.businessId?.toString() ?? null,
          createdAt: owner.createdAt,
        } as const),
      settings:
        settings &&
        ({
          plan: settings.plan,
          features: settings.features,
          localization: settings.localization,
          openingHours: settings.openingHours,
          bookingWelcomeMessage: settings.bookingWelcomeMessage ?? '',
        } as const),
      defaultService:
        defaultService &&
        ({
          _id: defaultService._id.toString(),
          name: defaultService.name,
          durationMinutes: defaultService.durationMinutes,
          price: defaultService.price,
          isActive: defaultService.isActive,
        } as const),
      credentialsSentVia: 'server_log',
    });
  } catch (err: unknown) {
    const status =
      typeof err === 'object' && err !== null && 'status' in err
        ? (err as { status: number }).status
        : undefined;
    if (status === 409) {
      res.status(409).json({
        message: err instanceof Error ? err.message : 'Conflict',
      });
      return;
    }
    logger.error('create_admin_business_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /api/admin/impersonate
export async function adminImpersonate(req: AuthRequest, res: Response): Promise<any> {
  try {
    const { businessId } = req.body;

    if (!businessId) {
      return res.status(400).json({ message: 'businessId is required' });
    }
    if (!Types.ObjectId.isValid(String(businessId))) {
      return res.status(400).json({ message: 'Invalid businessId' });
    }

    // Verify business exists
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Load the acting admin's own current record — the impersonation token's
    // pwv must be THEIR passwordChangedAt (the real actor), never the
    // impersonated business owner's. See signImpersonationToken.
    const admin = await User.findById(req.user.userId).select('email passwordChangedAt').lean();
    if (!admin) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    logger.info('audit_impersonation_start', {
      adminUserId: req.user.userId,
      businessId,
      at: new Date().toISOString(),
    });

    await recordAudit({
      actorUserId: req.user.userId,
      actorEmail: req.user.email,
      action: 'impersonation.start',
      entity: 'Business',
      entityId: businessId,
      metadata: { businessId },
    });

    const token = signImpersonationToken(
      {
        userId: req.user.userId,
        role: 'super_admin',
        email: admin.email,
        passwordChangedAt: admin.passwordChangedAt,
      },
      String(businessId)
    );

    res.json({
      token,
      impersonatingBusinessId: businessId,
    });
  } catch (err) {
    logger.error('admin_impersonate_failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /api/admin/stop-impersonate
export async function adminStopImpersonate(req: AuthRequest, res: Response): Promise<void> {
  try {
    logger.info('audit_impersonation_stop', {
      adminUserId: req.user?.userId,
      at: new Date().toISOString(),
    });
    await recordAudit({
      actorUserId: req.user?.userId,
      actorEmail: req.user?.email,
      action: 'impersonation.stop',
      entity: 'Session',
      metadata: {},
    });
    // Just return success - frontend will restore original token
    res.json({ ok: true });
  } catch (err) {
    logger.error('admin_stop_impersonate_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PATCH /api/admin/businesses/:id/ui – super admin updates any business UI
export async function adminUpdateBusinessUi(req: AuthRequest, res: Response): Promise<any> {
  try {
    const businessId = req.params.id;
    if (!Types.ObjectId.isValid(String(businessId))) {
      return res.status(400).json({ message: 'Invalid business id' });
    }
    const result = validateBusinessUiBody(req.body);
    if (!result.valid) {
      return res.status(400).json({ message: result.message });
    }

    const publicTheme = req.body?.publicTheme;
    let presetUpdate: string | undefined;
    let defaultModeUpdate: 'light' | 'dark' | undefined;
    if (publicTheme !== undefined) {
      if (typeof publicTheme !== 'object' || publicTheme === null) {
        return res.status(400).json({ message: 'publicTheme must be an object' });
      }
      if (publicTheme.preset !== undefined) {
        if (typeof publicTheme.preset !== 'string' || !isValidThemePresetId(publicTheme.preset)) {
          return res.status(400).json({
            message: `publicTheme.preset must be one of: ${VALID_THEME_PRESET_IDS.join(', ')}`,
          });
        }
        presetUpdate = publicTheme.preset;
      }
      if (publicTheme.defaultMode !== undefined) {
        if (publicTheme.defaultMode !== 'light' && publicTheme.defaultMode !== 'dark') {
          return res.status(400).json({ message: 'publicTheme.defaultMode must be "light" or "dark"' });
        }
        defaultModeUpdate = publicTheme.defaultMode;
      }
    }

    const hasUiFields = !!result.ui && Object.keys(result.ui).length > 0;
    if (!hasUiFields && presetUpdate === undefined && defaultModeUpdate === undefined) {
      return res.status(400).json({ message: 'No valid UI fields to update' });
    }

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    if (hasUiFields) {
      const currentUi = business.ui && typeof business.ui === 'object' ? business.ui : {};
      const merged = { ...currentUi, ...result.ui };
      business.ui = merged as any;
      await business.save();
    }

    const settings = await ensureBusinessSettings(business._id);
    if (presetUpdate !== undefined) settings.theme.preset = presetUpdate;
    if (defaultModeUpdate !== undefined) settings.theme.defaultMode = defaultModeUpdate;
    if (presetUpdate !== undefined || defaultModeUpdate !== undefined) {
      await settings.save();
    }

    return res.json({
      ui: normalizeBusinessUi(business.ui),
      publicTheme: { preset: settings.theme.preset, defaultMode: settings.theme.defaultMode },
    });
  } catch (err) {
    logger.error('admin_patch_business_ui_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ message: 'Internal server error' });
  }
}