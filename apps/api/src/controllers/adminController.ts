import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../middleware/auth';
import { Business } from '../models/Business';
import { BusinessSettings } from '../models/BusinessSettings';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { generateSlug } from '../utils/slug';

// GET /api/admin/businesses
export async function getAdminBusinesses(req: AuthRequest, res: Response): Promise<void> {
  try {
    const businesses = await Business.find({}).sort({ createdAt: -1 }).lean();

    // Load settings for each business
    const businessesWithSettings = await Promise.all(
      businesses.map(async (business) => {
        const settings = await ensureBusinessSettings(business._id);
        return {
          _id: business._id.toString(),
          name: business.name,
          slug: business.slug,
          createdAt: business.createdAt,
          updatedAt: business.updatedAt,
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

    res.json(businessesWithSettings);
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

