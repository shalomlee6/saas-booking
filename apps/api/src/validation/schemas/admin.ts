import { z } from 'zod';

/**
 * POST /api/admin/businesses — accepted JSON shape.
 * Unknown keys are **stripped** (not an error). Only `name` is read by the handler.
 *
 * Intended contract:
 * - `name`: non-empty trimmed string (max 200 chars).
 */
export const createAdminBusinessBodySchema = z.object({
  name: z.string().min(1).max(200).trim(),
});

export const patchAdminUserBodySchema = z
  .object({
    status: z.enum(['active', 'disabled']).optional(),
    name: z.string().max(200).trim().optional(),
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
