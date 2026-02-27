import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../middleware/auth';
import { Business } from '../models/Business';
import { User } from '../models/User';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { generateSlug } from '../utils/slug';
import { normalizeBusinessUi, validateBusinessUiBody } from '../utils/businessUi';

// GET /api/admin/businesses
export async function getAdminBusinesses(req: AuthRequest, res: Response): Promise<void> {
  try {
    const businesses = await Business.find({}).sort({ createdAt: -1 }).lean();

    const businessesWithOwner = await Promise.all(
      businesses.map(async (business: any) => {
        const owner = await User.findById(business.ownerId).lean();
        const settings = await ensureBusinessSettings(business._id);
        return {
          _id: business._id.toString(),
          name: business.name,
          slug: business.slug,
          ownerEmail: owner?.email ?? null,
          ownerPhone: (owner as any)?.phone ?? null,
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

// POST /api/admin/businesses
export async function createAdminBusiness(req: AuthRequest, res: Response): Promise<any> {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ message: 'name is required' });
    }

    // Generate unique slug
    const baseSlug = generateSlug(name);
    let slug = baseSlug;
    let counter = 1;

    // Ensure slug is unique
    while (await Business.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create business (no ownerId for admin-created businesses, or use a system user)
    const business = await Business.create({
      name,
      slug,
      ownerId: req.user?.userId, // Use super admin as owner, or create a system owner
    });

    // Create default settings
    await ensureBusinessSettings(business._id);

    res.status(201).json({
      _id: business._id.toString(),
      name: business.name,
      slug: business.slug,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
    });
  } catch (err) {
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

    // Verify business exists
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Create impersonation token
    const token = jwt.sign(
      {
        userId: req.user.userId,
        role: 'super_admin',
        email: req.user.email,
        impersonatingBusinessId: businessId,
        impersonating: true,
      },
      process.env.JWT_SECRET || 'dev-secret',
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
