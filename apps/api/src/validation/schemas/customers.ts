import { z } from 'zod';
import { mongoObjectIdString } from '../primitives';
import { timeOfDayBucketZod } from '../../dto/enums';

const optionalEmail = z.union([z.string().email(), z.literal('')]).optional();

const customerPreferencesBodySchema = z
  .object({
    preferredStaffId: z.union([mongoObjectIdString, z.literal('')]).optional(),
    preferredTimeOfDay: timeOfDayBucketZod.optional(),
    allergies: z.string().max(2_000).optional(),
    tags: z.array(z.string().min(1).max(60)).max(50).optional(),
  })
  .strict();

export const customerCreateBodySchema = z
  .object({
    name: z.string().min(1).max(200).trim(),
    phone: z.string().min(1).max(40).trim(),
    email: optionalEmail,
    notes: z.string().max(10_000).optional(),
    preferences: customerPreferencesBodySchema.optional(),
  })
  .strict();

export const customerUpdateBodySchema = z
  .object({
    name: z.string().min(1).max(200).trim().optional(),
    phone: z.string().min(1).max(40).trim().optional(),
    email: optionalEmail,
    notes: z.string().max(10_000).optional(),
    preferences: customerPreferencesBodySchema.optional(),
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

export const customersBulkDeleteBodySchema = z
  .object({
    ids: z.array(mongoObjectIdString).min(1).max(200),
  })
  .strict();

export const customersListQuerySchema = z.object({
  search: z.preprocess(
    (v) => (Array.isArray(v) ? v[0] : v),
    z.string().max(200).optional()
  ),
});
