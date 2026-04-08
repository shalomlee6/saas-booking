import { z } from 'zod';
import { mongoObjectIdString } from '../primitives';

const optionalEmail = z.union([z.string().email(), z.literal('')]).optional();

export const customerCreateBodySchema = z
  .object({
    name: z.string().min(1).max(200).trim(),
    phone: z.string().min(1).max(40).trim(),
    email: optionalEmail,
    notes: z.string().max(10_000).optional(),
  })
  .strict();

export const customerUpdateBodySchema = z
  .object({
    name: z.string().min(1).max(200).trim().optional(),
    phone: z.string().min(1).max(40).trim().optional(),
    email: optionalEmail,
    notes: z.string().max(10_000).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field is required',
  });

export const customerIdParamsSchema = z
  .object({
    id: mongoObjectIdString,
  })
  .strict();

export const customersListQuerySchema = z.object({
  search: z.preprocess(
    (v) => (Array.isArray(v) ? v[0] : v),
    z.string().max(200).optional()
  ),
});
