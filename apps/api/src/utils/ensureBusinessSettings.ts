import { Types } from 'mongoose';
import { BusinessSettings, IBusinessSettings } from '../models/BusinessSettings';

export async function ensureBusinessSettings(
  businessId: string | Types.ObjectId
): Promise<IBusinessSettings> {
  const businessIdObj = typeof businessId === 'string' ? new Types.ObjectId(businessId) : businessId;

  let settings = await BusinessSettings.findOne({ businessId: businessIdObj });

  if (!settings) {
    // Create default settings
    settings = await BusinessSettings.create({
      businessId: businessIdObj,
      plan: 'free',
      theme: {
        colors: {
          primary: '#F35271',
          secondary: '#FF9DBC',
          accent: '#6CD6CD',
          background: '#FFFFFF',
          text: '#111827',
        },
        logoUrl: null,
        fontFamily: 'system-ui',
      },
      features: {
        bookingEnabled: true,
        paymentsEnabled: false,
        marketingModule: false,
        chatModule: false,
        waitlistEnabled: false,
        analyticsEnabled: false,
        customDomainEnabled: false,
      },
      localization: {
        language: 'he',
        timezone: 'Asia/Jerusalem',
        currency: 'ILS',
      },
    });
  }

  return settings;
}

