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
import { settingsDocToClientJson } from '../utils/publicUploadUrl';
import { recordAudit } from '../utils/recordAudit';
import {
  readOwnerBookingSettings,
  saveOwnerBookingRules,
  saveOwnerReliability,
} from '../services/bookingSettingsService';
import type { BookingRulesBody, ReliabilityBody } from '../validation/schemas/bookingSettings';
import type { PublicThemeBody } from '../validation/schemas/businessSettings';
import { savePublicTheme } from '../services/publicThemeService';

export async function getMyBusinessSettings(req: AuthRequest, res: Response): Promise<void> {
  if (!req.businessSettings) {
    const businessId = getEffectiveBusinessId(req);
    if (!businessId) {
      throw new ValidationError('Business ID not found');
    }
    const settings = await ensureBusinessSettings(businessId);
    res.json(settingsDocToClientJson(settings));
    return;
  }

  res.json(settingsDocToClientJson(req.businessSettings));
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
    res.json(settingsDocToClientJson(current));
    return;
  }

  const updated = await updateBusinessSettingsPartial(businessIdObj, updateData);

  if (!updated) {
    throw new NotFoundError('Settings not found');
  }

  res.json(settingsDocToClientJson(updated));
}

export async function getOwnerBookingSettings(req: AuthRequest, res: Response): Promise<void> {
  const businessId = getEffectiveBusinessId(req);
  if (!businessId) throw new ValidationError('Business ID not found');
  res.json(await readOwnerBookingSettings(businessId));
}

export async function putOwnerBookingRules(req: AuthRequest, res: Response): Promise<void> {
  const businessId = getEffectiveBusinessId(req);
  if (!businessId) throw new ValidationError('Business ID not found');
  const result = await saveOwnerBookingRules(businessId, req.body as BookingRulesBody);
  if (result.changed) {
    await recordAudit({
      actorUserId: req.user?.userId,
      actorEmail: req.user?.email,
      action: 'business.settings_updated',
      entity: 'BusinessSettings',
      entityId: result.settingsId,
      metadata: { businessId, section: 'booking', before: result.previous, after: result.current },
    });
  }
  res.json(await readOwnerBookingSettings(businessId));
}

export async function putOwnerReliability(req: AuthRequest, res: Response): Promise<void> {
  const businessId = getEffectiveBusinessId(req);
  if (!businessId) throw new ValidationError('Business ID not found');
  const result = await saveOwnerReliability(businessId, req.body as ReliabilityBody);
  if (result.changed) {
    await recordAudit({
      actorUserId: req.user?.userId,
      actorEmail: req.user?.email,
      action: 'business.settings_updated',
      entity: 'BusinessSettings',
      entityId: result.settingsId,
      metadata: { businessId, section: 'reliability', before: result.previous, after: result.current },
    });
  }
  res.json(await readOwnerBookingSettings(businessId));
}

/** PUT /api/settings/me/public-theme — the client-site theme (owner only). Applies to the public site at once. */
export async function putOwnerPublicTheme(req: AuthRequest, res: Response): Promise<void> {
  const businessId = getEffectiveBusinessId(req);
  if (!businessId) throw new ValidationError('Business ID not found');
  const result = await savePublicTheme(businessId, req.body as PublicThemeBody);
  if (result.changed) {
    await recordAudit({
      actorUserId: req.user?.userId,
      actorEmail: req.user?.email,
      action: 'business.public_theme_updated',
      entity: 'BusinessSettings',
      entityId: result.settingsId,
      metadata: { businessId, before: result.previous, after: result.current },
    });
  }
  res.json({ publicTheme: result.current });
}
