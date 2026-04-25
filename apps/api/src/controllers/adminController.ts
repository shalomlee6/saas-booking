import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { validateEnv } from '../config/env';
import { AuthRequest } from '../middleware/auth';
import { Business } from '../models/Business';
import { User } from '../models/User';
import { BusinessSettings } from '../models/BusinessSettings';
import { Service } from '../models/Service';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { normalizeBusinessUi, validateBusinessUiBody } from '../utils/businessUi';
import { recordAudit } from '../utils/recordAudit';
import { provisionTenant } from '../utils/provisionTenant';
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
    console.error('Error GET /admin/businesses:', err);
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
    console.error('Error POST /admin/businesses:', err);
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

    console.info('[AUDIT] impersonation_start', {
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

    // Create impersonation token
    const env = validateEnv();
    const token = jwt.sign(
      {
        userId: req.user.userId,
        role: 'super_admin',
        email: req.user.email,
        impersonatingBusinessId: businessId,
        impersonating: true,
      },
      env.JWT_SECRET,
      { expiresIn: '30m' } // 30 minutes
    );

    res.json({
      token,
      impersonatingBusinessId: businessId,
    });
  } catch (err) {
    console.error('Error POST /admin/impersonate:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /api/admin/stop-impersonate
export async function adminStopImpersonate(req: AuthRequest, res: Response): Promise<void> {
  try {
    console.info('[AUDIT] impersonation_stop', {
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
    console.error('Error POST /admin/stop-impersonate:', err);
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
    if (!result.ui || Object.keys(result.ui).length === 0) {
      return res.status(400).json({ message: 'No valid UI fields to update' });
    }
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }
    const currentUi = business.ui && typeof business.ui === 'object' ? business.ui : {};
    const merged = { ...currentUi, ...result.ui };
    business.ui = merged as any;
    await business.save();
    return res.json({ ui: normalizeBusinessUi(business.ui) });
  } catch (err) {
    console.error('Error PATCH /admin/businesses/:id/ui:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}