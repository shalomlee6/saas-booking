import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../errors/httpErrors';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { getEffectiveBusinessId } from '../utils/effectiveBusinessId';
import type { UpdateBusinessSettingsBody } from '../validation/schemas/businessSettings';
import {
  buildBusinessSettingsUpdateSet,
  findBusinessSettingsByBusinessId,
  updateBusinessSettingsPartial,
} from '../services/businessSettingsService';

export async function getMyBusinessSettings(req: AuthRequest, res: Response): Promise<void> {
  if (!req.businessSettings) {
    const businessId = getEffectiveBusinessId(req);
    if (!businessId) {
      throw new ValidationError('Business ID not found');
    }
    const settings = await ensureBusinessSettings(businessId);
    res.json(settings);
    return;
  }

  res.json(req.businessSettings);
}

export async function updateMyBusinessSettings(req: AuthRequest, res: Response): Promise<void> {
  let businessId: string | undefined;

  if (req.businessSettings) {
    businessId = req.businessSettings.businessId.toString();
  } else {
    businessId = getEffectiveBusinessId(req);
  }

  if (!businessId) {
    throw new ValidationError('Business ID not found');
  }

  await ensureBusinessSettings(businessId);

  const businessIdObj = new Types.ObjectId(businessId);
  const body = req.body as UpdateBusinessSettingsBody;
  const updateData = buildBusinessSettingsUpdateSet(body);

  if (Object.keys(updateData).length === 0) {
    const current = await findBusinessSettingsByBusinessId(businessIdObj);
    if (!current) {
      throw new NotFoundError('Settings not found');
    }
    res.json(current);
    return;
  }

  const updated = await updateBusinessSettingsPartial(businessIdObj, updateData);

  if (!updated) {
    throw new NotFoundError('Settings not found');
  }

  res.json(updated);
}
