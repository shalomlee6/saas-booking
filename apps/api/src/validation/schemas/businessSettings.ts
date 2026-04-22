import { z } from 'zod';
import { settingsLanguageZod, settingsPlanZod } from '../../dto/enums';

const themeColorsSchema = z
  .object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    accent: z.string().optional(),
    background: z.string().optional(),
    text: z.string().optional(),
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
    portfolioImages: z.array(z.string().max(2000)).max(50).optional(),
    landingProducts: z.array(landingProductSchema).max(30).optional(),
    publicRating: z.number().min(1).max(5).optional(),
    businessPhonePublic: z.string().max(40).trim().optional().or(z.literal('')),
  })
  .strict();

export type UpdateBusinessSettingsBody = z.infer<typeof updateBusinessSettingsBodySchema>;
