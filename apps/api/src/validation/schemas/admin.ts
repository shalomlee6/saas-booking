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
