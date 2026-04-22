import { z } from 'zod';

/**
 * POST /api/admin/businesses — full tenant provisioning (owner + business + settings + default service).
 */
export const createAdminBusinessBodySchema = z.object({
  businessName: z.string().min(1).max(200).trim(),
  ownerFullName: z.string().min(1).max(200).trim(),
  ownerEmail: z.string().email().max(320).trim().toLowerCase(),
  ownerPhone: z.string().max(40).trim().optional().or(z.literal('')),
  plan: z.enum(['free', 'pro', 'premium']),
  timezone: z.string().min(1).max(80).trim().default('Asia/Jerusalem'),
  businessSlug: z
    .union([z.string().max(60).trim(), z.literal('')])
    .optional()
    .transform((s) => (s === '' ? undefined : s)),
  ownerPassword: z
    .union([z.string().min(8).max(128), z.literal('')])
    .optional()
    .transform((s) => (s === '' ? undefined : s)),
});

export const patchAdminUserBodySchema = z
  .object({
    status: z.enum(['active', 'disabled']).optional(),
    name: z.string().max(200).trim().optional(),
  })
  .strict();

export const patchAdminUserPlanBodySchema = z
  .object({
    plan: z.enum(['free', 'pro', 'premium']),
  })
  .strict();

export const patchPlatformSettingsBodySchema = z
  .object({
    defaultTrialDurationDays: z.number().int().min(0).max(3650).optional(),
    maintenanceMode: z.boolean().optional(),
    featureFlags: z.record(z.string(), z.boolean()).optional(),
    platformDisplayName: z.string().min(1).max(120).trim().optional(),
  })
  .strict();
