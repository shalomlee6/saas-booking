import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BusinessSettings } from '../models/BusinessSettings';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { getEffectiveBusinessId } from '../utils/effectiveBusinessId';
import type { UpdateBusinessSettingsBody } from '../validation/schemas/businessSettings';
import { Types } from 'mongoose';

export async function getMyBusinessSettings(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.businessSettings) {
      const businessId = getEffectiveBusinessId(req);
      if (!businessId) {
        res.status(400).json({ message: 'Business ID not found' });
        return;
      }
      const settings = await ensureBusinessSettings(businessId);
      res.json(settings);
      return;
    }

    res.json(req.businessSettings);
  } catch (err) {
    console.error('Error GET /settings/me/settings:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function updateMyBusinessSettings(req: AuthRequest, res: Response): Promise<void> {
  try {
    let businessId: string | undefined;

    if (req.businessSettings) {
      businessId = req.businessSettings.businessId.toString();
    } else {
      businessId = getEffectiveBusinessId(req);
    }

    if (!businessId) {
      res.status(400).json({ message: 'Business ID not found' });
      return;
    }

    await ensureBusinessSettings(businessId);

    const businessIdObj = new Types.ObjectId(businessId);
    const body = req.body as UpdateBusinessSettingsBody;

    const updateData: Record<string, unknown> = {};

    if (body.plan !== undefined) {
      updateData.plan = body.plan;
    }

    if (body.theme) {
      const theme: Record<string, unknown> = {};
      if (body.theme.colors) {
        const colors: Record<string, unknown> = {};
        const c = body.theme.colors;
        if (c.primary !== undefined) colors.primary = c.primary;
        if (c.secondary !== undefined) colors.secondary = c.secondary;
        if (c.accent !== undefined) colors.accent = c.accent;
        if (c.background !== undefined) colors.background = c.background;
        if (c.text !== undefined) colors.text = c.text;
        if (Object.keys(colors).length) theme.colors = colors;
      }
      if (body.theme.logoUrl !== undefined) {
        theme.logoUrl = body.theme.logoUrl;
      }
      if (body.theme.fontFamily !== undefined) {
        theme.fontFamily = body.theme.fontFamily;
      }
      if (Object.keys(theme).length) {
        updateData.theme = theme;
      }
    }

    if (body.features) {
      const features: Record<string, unknown> = {};
      const f = body.features;
      if (f.bookingEnabled !== undefined) features.bookingEnabled = f.bookingEnabled;
      if (f.paymentsEnabled !== undefined) features.paymentsEnabled = f.paymentsEnabled;
      if (f.marketingModule !== undefined) features.marketingModule = f.marketingModule;
      if (f.chatModule !== undefined) features.chatModule = f.chatModule;
      if (f.waitlistEnabled !== undefined) features.waitlistEnabled = f.waitlistEnabled;
      if (Object.keys(features).length) {
        updateData.features = features;
      }
    }

    if (body.localization) {
      const loc: Record<string, unknown> = {};
      const l = body.localization;
      if (l.language !== undefined) loc.language = l.language;
      if (l.timezone !== undefined) loc.timezone = l.timezone;
      if (l.currency !== undefined) loc.currency = l.currency;
      if (Object.keys(loc).length) {
        updateData.localization = loc;
      }
    }

    if (Object.keys(updateData).length === 0) {
      const current = await BusinessSettings.findOne({ businessId: businessIdObj });
      if (!current) {
        res.status(404).json({ message: 'Settings not found' });
        return;
      }
      res.json(current);
      return;
    }

    const updated = await BusinessSettings.findOneAndUpdate(
      { businessId: businessIdObj },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updated) {
      res.status(404).json({ message: 'Settings not found' });
      return;
    }

    res.json(updated);
  } catch (err) {
    console.error('Error PUT /settings/me/settings:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}
