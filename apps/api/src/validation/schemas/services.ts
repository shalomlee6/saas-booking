import { z } from 'zod';
import { mongoObjectIdString } from '../primitives';

export const serviceIdParamsSchema = z
  .object({
    id: mongoObjectIdString,
  })
  .strict();

/** Empty price inputs arrive as a missing key, null, or NaN. Treat those as 0. */
const servicePriceSchema = z.preprocess(
  (value) => (value == null || (typeof value === 'number' && Number.isNaN(value)) ? 0 : value),
  z.coerce.number().min(0)
);

export const serviceCreateBodySchema = z
  .object({
    name: z.string().min(1).max(200).trim(),
    price: servicePriceSchema,
    durationMinutes: z.coerce.number().int().min(1),
    description: z.string().max(10_000).optional(),
    colorHex: z.string().max(32).optional(),
    textColorHex: z.string().max(32).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const serviceUpdateBodySchema = z
  .object({
    name: z.string().min(1).max(200).trim().optional(),
    description: z.string().max(10_000).optional(),
    durationMinutes: z.coerce.number().int().min(1).optional(),
    price: z.coerce.number().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field is required',
  });
