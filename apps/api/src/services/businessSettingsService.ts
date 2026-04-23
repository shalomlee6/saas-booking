import { Types } from 'mongoose';
import { BusinessSettings } from '../models/BusinessSettings';
import type { UpdateBusinessSettingsBody } from '../validation/schemas/businessSettings';

/**
 * Maps validated API body to Mongo `$set` payload (partial nested updates).
 */
export function buildBusinessSettingsUpdateSet(
  body: UpdateBusinessSettingsBody
): Record<string, unknown> {
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
    if (f.analyticsEnabled !== undefined) features.analyticsEnabled = f.analyticsEnabled;
    if (f.customDomainEnabled !== undefined) features.customDomainEnabled = f.customDomainEnabled;
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

  if (body.bookingWelcomeMessage !== undefined) {
    updateData.bookingWelcomeMessage = body.bookingWelcomeMessage;
  }
  if (body.landingTagline !== undefined) {
    updateData.landingTagline = body.landingTagline;
  }
  if (body.coverImageUrl !== undefined) {
    updateData.coverImageUrl = body.coverImageUrl;
  }
  if (body.landingSecondaryHeroImageUrl !== undefined) {
    updateData.landingSecondaryHeroImageUrl = body.landingSecondaryHeroImageUrl;
  }
  if (body.landingHeroDescription !== undefined) {
    updateData.landingHeroDescription = body.landingHeroDescription;
  }
  if (body.landingGalleryItems !== undefined) {
    const items = body.landingGalleryItems.map((g) => ({
      id: g.id,
      imageUrl: g.imageUrl.trim(),
      title: g.title?.trim() ? g.title.trim() : '',
      type: g.type === 'product' ? 'product' : 'service',
    }));
    updateData.landingGalleryItems = items;
    updateData.portfolioImages = items.map((i) => i.imageUrl).filter(Boolean);
  }
  if (body.landingContact !== undefined) {
    updateData.landingContact = {
      whatsapp: body.landingContact.whatsapp?.trim() ?? '',
      email: body.landingContact.email?.trim().toLowerCase() ?? '',
      location: body.landingContact.location?.trim() ?? '',
    };
  }
  if (body.landingServiceOrder !== undefined) {
    updateData.landingServiceOrder = body.landingServiceOrder;
  }
  if (body.landingSectionVisibility !== undefined) {
    updateData.landingSectionVisibility = body.landingSectionVisibility;
  }
  if (body.portfolioImages !== undefined) {
    updateData.portfolioImages = body.portfolioImages;
  }
  if (body.landingProducts !== undefined) {
    updateData.landingProducts = body.landingProducts.map((p) => ({
      name: p.name,
      description: p.description?.trim() ? p.description.trim() : undefined,
      price: p.price,
    }));
  }
  if (body.publicRating !== undefined) {
    updateData.publicRating = body.publicRating;
  }
  if (body.businessPhonePublic !== undefined) {
    updateData.businessPhonePublic = body.businessPhonePublic;
  }

  return updateData;
}

export async function findBusinessSettingsByBusinessId(businessIdObj: Types.ObjectId) {
  return BusinessSettings.findOne({ businessId: businessIdObj });
}

export async function updateBusinessSettingsPartial(
  businessIdObj: Types.ObjectId,
  updateData: Record<string, unknown>
) {
  if (Object.keys(updateData).length === 0) {
    return findBusinessSettingsByBusinessId(businessIdObj);
  }
  return BusinessSettings.findOneAndUpdate(
    { businessId: businessIdObj },
    { $set: updateData },
    { new: true, runValidators: true }
  );
}
