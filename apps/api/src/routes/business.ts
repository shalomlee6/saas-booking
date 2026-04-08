import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { requireBusinessContext } from '../middleware/requireBusinessContext';
import { Business } from '../models/Business';
import { normalizeBusinessUi, validateBusinessUiBody } from '../utils/businessUi';
import { getEffectiveBusinessId } from '../utils/effectiveBusinessId';
import { patchOpeningHours } from '../controllers/openingHoursController';
import {
  getOverrides,
  postOverride,
  deleteOverride,
} from '../controllers/availabilityOverridesController';
import { getBusinessInsights } from '../controllers/insightsController';

export const businessRouter = Router();

businessRouter.get('/me', auth, async (req: AuthRequest, res) => {
  try {
    const business = await Business.findOne({ ownerId: req.user!.userId });

    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    return res.json(business);
  } catch (err) {
    console.error('Error in /business/me:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/business/ui – owner updates own business UI (tenant from JWT / impersonation)
businessRouter.patch('/ui', auth, requireBusinessContext, async (req: AuthRequest, res) => {
  try {
    if (req.user!.role !== 'owner') {
      return res.status(403).json({ message: 'Only business owners can update their business UI' });
    }
    const businessId = getEffectiveBusinessId(req)!;
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
    console.error('Error PATCH /business/ui:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/business/settings/opening-hours – default weekly schedule
businessRouter.patch('/settings/opening-hours', auth, requireBusinessContext, patchOpeningHours);

// Growth insights (revenue, top customers, etc.)
businessRouter.get('/insights', auth, requireBusinessContext, getBusinessInsights);

// Availability overrides (date-specific exceptions)
businessRouter.get('/overrides', auth, requireBusinessContext, getOverrides);
businessRouter.post('/overrides', auth, requireBusinessContext, postOverride);
businessRouter.delete('/overrides/:id', auth, requireBusinessContext, deleteOverride);
