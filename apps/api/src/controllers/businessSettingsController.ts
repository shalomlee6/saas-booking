import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { getEffectiveBusinessId } from '../utils/effectiveBusinessId';
import type { UpdateBusinessSettingsBody } from '../validation/schemas/businessSettings';
import {
  buildBusinessSettingsUpdateSet,
  findBusinessSettingsByBusinessId,
  updateBusinessSettingsPartial,
} from '../services/businessSettingsService';

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
    const updateData = buildBusinessSettingsUpdateSet(body);

    if (Object.keys(updateData).length === 0) {
      const current = await findBusinessSettingsByBusinessId(businessIdObj);
      if (!current) {
        res.status(404).json({ message: 'Settings not found' });
        return;
      }
      res.json(current);
      return;
    }

    const updated = await updateBusinessSettingsPartial(businessIdObj, updateData);

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
