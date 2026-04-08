import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BusinessSettings } from '../models/BusinessSettings';
import { Business } from '../models/Business';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { getEffectiveBusinessId } from '../utils/effectiveBusinessId';
import { Types } from 'mongoose';

export async function getMyBusinessSettings(req: AuthRequest, res: Response): Promise<any> {
  try {
    if (!req.businessSettings) {
      // Should not happen if middleware runs, but handle gracefully
      const businessId = getEffectiveBusinessId(req);
      if (!businessId) {
        return res.status(400).json({ message: 'Business ID not found' });
      }
      const settings = await ensureBusinessSettings(businessId);
      return res.json(settings);
    }

    res.json(req.businessSettings);
  } catch (err) {
    console.error('Error GET /settings/me/settings:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function updateMyBusinessSettings(req: AuthRequest, res: Response): Promise<any> {
  try {
    let businessId: string | undefined;

    if (req.businessSettings) {
      businessId = req.businessSettings.businessId.toString();
    } else {
      businessId = getEffectiveBusinessId(req);
    }

    if (!businessId) {
      return res.status(400).json({ message: 'Business ID not found' });
    }

    // Ensure settings exist
    await ensureBusinessSettings(businessId);

    const businessIdObj = new Types.ObjectId(businessId);

    const { plan, theme, features, localization } = req.body;

    const updateData: any = {};

    // Validate and update plan
    if (plan && ['free', 'normal', 'premium'].includes(plan)) {
      updateData.plan = plan;
    }

    // Validate and update theme (partial update)
    if (theme) {
      updateData.theme = {};
      if (theme.colors) {
        updateData.theme.colors = {};
        if (typeof theme.colors.primary === 'string') updateData.theme.colors.primary = theme.colors.primary;
        if (typeof theme.colors.secondary === 'string') updateData.theme.colors.secondary = theme.colors.secondary;
        if (typeof theme.colors.accent === 'string') updateData.theme.colors.accent = theme.colors.accent;
        if (typeof theme.colors.background === 'string') updateData.theme.colors.background = theme.colors.background;
        if (typeof theme.colors.text === 'string') updateData.theme.colors.text = theme.colors.text;
      }
      if (theme.logoUrl !== undefined) {
        updateData.theme.logoUrl = theme.logoUrl === null ? null : String(theme.logoUrl);
      }
      if (typeof theme.fontFamily === 'string') {
        updateData.theme.fontFamily = theme.fontFamily;
      }
    }

    // Validate and update features (partial update)
    if (features) {
      updateData.features = {};
      if (typeof features.bookingEnabled === 'boolean') updateData.features.bookingEnabled = features.bookingEnabled;
      if (typeof features.paymentsEnabled === 'boolean') updateData.features.paymentsEnabled = features.paymentsEnabled;
      if (typeof features.marketingModule === 'boolean') updateData.features.marketingModule = features.marketingModule;
      if (typeof features.chatModule === 'boolean') updateData.features.chatModule = features.chatModule;
      if (typeof features.waitlistEnabled === 'boolean') updateData.features.waitlistEnabled = features.waitlistEnabled;
    }

    // Validate and update localization (partial update)
    if (localization) {
      updateData.localization = {};
      if (['he', 'en'].includes(localization.language)) {
        updateData.localization.language = localization.language;
      }
      if (typeof localization.timezone === 'string') {
        updateData.localization.timezone = localization.timezone;
      }
      if (typeof localization.currency === 'string') {
        updateData.localization.currency = localization.currency;
      }
    }

    // Use $set for partial updates
    const updated = await BusinessSettings.findOneAndUpdate(
      { businessId: businessIdObj },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    res.json(updated);
  } catch (err) {
    console.error('Error PUT /settings/me/settings:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

