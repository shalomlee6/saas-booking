import { z } from 'zod';
import { settingsLanguageZod, settingsPlanZod } from '../../dto/enums';

const themeColorsSchema = z
  .object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    background: z.string().optional(),
  })
  .strict()
  .optional();

const themeSchema = z
  .object({
    colors: themeColorsSchema,
    logoUrl: z.union([z.string(), z.null()]).optional(),
    fontFamily: z.string().optional(),
  })
  .strict()
  .optional();

const featuresSchema = z
  .object({
    bookingEnabled: z.boolean().optional(),
    paymentsEnabled: z.boolean().optional(),
    marketingModule: z.boolean().optional(),
    chatModule: z.boolean().optional(),
    waitlistEnabled: z.boolean().optional(),
    analyticsEnabled: z.boolean().optional(),
    customDomainEnabled: z.boolean().optional(),
  })
  .strict()
  .optional();

const localizationSchema = z
  .object({
    language: settingsLanguageZod.optional(),
    timezone: z.string().optional(),
    currency: z.string().optional(),
  })
  .strict()
  .optional();

const landingProductSchema = z
  .object({
    name: z.string().min(1).max(200).trim(),
    description: z.string().max(500).trim().optional().or(z.literal('')),
    price: z.number().min(0).max(1_000_000),
  })
  .strict();

const landingGalleryItemSchema = z
  .object({
    id: z.string().min(1).max(120),
    imageUrl: z.string().min(1).max(2000),
    title: z.string().max(200).trim().optional().or(z.literal('')),
    type: z.enum(['product', 'service']).optional(),
  })
  .strict();

const landingContactSchema = z
  .object({
    whatsapp: z.string().max(40).trim().optional().or(z.literal('')),
    email: z.string().max(320).trim().optional().or(z.literal('')),
    location: z.string().max(500).trim().optional().or(z.literal('')),
  })
  .strict()
  .superRefine((data, ctx) => {
    const e = data.email?.trim() ?? '';
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'Invalid email' });
    }
  });

const landingSectionVisibilitySchema = z
  .object({
    hero: z.boolean().optional(),
    services: z.boolean().optional(),
    gallery: z.boolean().optional(),
    products: z.boolean().optional(),
    reviews: z.boolean().optional(),
    cta: z.boolean().optional(),
  })
  .strict();

/** PUT /api/settings/me/settings — partial document; unknown keys rejected */
export const updateBusinessSettingsBodySchema = z
  .object({
    plan: settingsPlanZod.optional(),
    theme: themeSchema,
    features: featuresSchema,
    localization: localizationSchema,
    bookingWelcomeMessage: z.string().max(2000).trim().optional().or(z.literal('')),
    landingTagline: z.string().max(300).trim().optional().or(z.literal('')),
    coverImageUrl: z.string().max(2000).trim().optional().or(z.literal('')),
    landingSecondaryHeroImageUrl: z.string().max(2000).trim().optional().or(z.literal('')),
    landingHeroDescription: z.string().max(2000).trim().optional().or(z.literal('')),
    landingGalleryItems: z.array(landingGalleryItemSchema).max(50).optional(),
    landingContact: landingContactSchema.optional(),
    landingServiceOrder: z.array(z.string().max(80)).max(100).optional(),
    landingSectionVisibility: landingSectionVisibilitySchema.optional(),
    portfolioImages: z.array(z.string().max(2000)).max(50).optional(),
    landingProducts: z.array(landingProductSchema).max(30).optional(),
    publicRating: z.number().min(1).max(5).optional(),
    businessPhonePublic: z.string().max(40).trim().optional().or(z.literal('')),
  })
  .strict();

export type UpdateBusinessSettingsBody = z.infer<typeof updateBusinessSettingsBodySchema>;

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a 6-digit hex color like #3787F6');

/**
 * The public client-site theme: one object, written by both the owner (settings → design → client site)
 * and the super-admin "Edit Business UI" form. `colors` only matter while `preset` is "custom".
 */
export const publicThemeBodySchema = z
  .object({
    preset: z.enum(['prime-pink', 'prime-mint', 'custom']).optional(),
    defaultMode: z.enum(['light', 'dark']).optional(),
    colors: z
      .object({
        primary: hexColor.optional(),
        secondary: hexColor.optional(),
        background: hexColor.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'No public theme fields to update' });

export type PublicThemeBody = z.infer<typeof publicThemeBodySchema>;
