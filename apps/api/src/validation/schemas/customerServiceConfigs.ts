import { z } from 'zod';
import { mongoObjectIdString } from '../primitives';

export const customerServiceConfigCreateBodySchema = z
  .object({
    customerId: mongoObjectIdString,
    serviceId: mongoObjectIdString,
    durationOverrideMinutes: z.number().int().min(1).max(24 * 60).optional(),
    priceOverride: z.number().min(0).optional(),
    notes: z.string().max(10_000).optional(),
  })
  .strict();

export const customerServiceConfigUpdateBodySchema = z
  .object({
    // null explicitly clears the override, reverting to the service default.
    durationOverrideMinutes: z.union([z.number().int().min(1).max(24 * 60), z.null()]).optional(),
    priceOverride: z.union([z.number().min(0), z.null()]).optional(),
    notes: z.string().max(10_000).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field is required',
  });

export const customerServiceConfigIdParamsSchema = z
  .object({
    id: mongoObjectIdString,
  })
  .strict();

export const customerServiceConfigsListQuerySchema = z
  .object({
    customerId: mongoObjectIdString.optional(),
    serviceId: mongoObjectIdString.optional(),
  })
  .strict();
