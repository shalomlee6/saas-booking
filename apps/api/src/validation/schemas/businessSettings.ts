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

/** PUT /api/settings/me/settings — partial document; unknown keys rejected */
export const updateBusinessSettingsBodySchema = z
  .object({
    plan: settingsPlanZod.optional(),
    theme: themeSchema,
    features: featuresSchema,
    localization: localizationSchema,
  })
  .strict();

export type UpdateBusinessSettingsBody = z.infer<typeof updateBusinessSettingsBodySchema>;
