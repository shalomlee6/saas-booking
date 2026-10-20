import { Types } from 'mongoose';
import { BusinessSettings, IBusinessSettings } from '../models/BusinessSettings';

export async function ensureBusinessSettings(
  businessId: string | Types.ObjectId
): Promise<IBusinessSettings> {
  const businessIdObj = typeof businessId === 'string' ? new Types.ObjectId(businessId) : businessId;

  let settings = await BusinessSettings.findOne({ businessId: businessIdObj });

  if (!settings) {
    // Every field takes its default from the schema (BUSINESS_SETTINGS_DEFAULTS).
    settings = await BusinessSettings.create({ businessId: businessIdObj });
  }

  return settings;
}

