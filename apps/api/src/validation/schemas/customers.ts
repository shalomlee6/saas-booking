import { z } from 'zod';
import { mongoObjectIdString } from '../primitives';
import { timeOfDayBucketZod } from '../../dto/enums';
import {
  createEntityListQuerySchema,
  optionalQueryNumber,
  optionalQueryString,
  optionalYyyyMmDd,
} from '../../listQuery/schema';

/** Sort fields the paged customers list accepts. Metric fields are owner-only at request time. */
export const CUSTOMER_LIST_SORT_FIELDS = [
  'name',
  'phone',
  'createdAt',
  'totalVisits',
  'totalRevenue',
  'averageVisitValue',
  'lastVisit',
  'nextAppointment',
  'noShowCount',
] as const;

export const CUSTOMER_METRIC_SORT_FIELDS = [
  'totalVisits',
  'totalRevenue',
  'averageVisitValue',
  'lastVisit',
  'nextAppointment',
  'noShowCount',
] as const;

export const customersPagedQuerySchema = createEntityListQuerySchema({
  defaultSort: 'name',
  sortableFields: CUSTOMER_LIST_SORT_FIELDS,
  rangePairs: [
    { min: 'visitsMin', max: 'visitsMax' },
    { min: 'revenueMin', max: 'revenueMax' },
    { min: 'createdFrom', max: 'createdTo' },
  ],
  filters: {
    status: optionalQueryString().pipe(z.enum(['all', 'active', 'inactive']).optional()),
    blocked: optionalQueryString().pipe(z.enum(['true', 'false']).optional()),
    customerType: optionalQueryString().pipe(z.enum(['new', 'returning']).optional()),
    activity: optionalQueryString().pipe(
      z.enum(['noVisits', 'noUpcoming', 'lastVisitOver30', 'lastVisitOver60', 'lastVisitOver90']).optional()
    ),
    visitsMin: optionalQueryNumber(),
    visitsMax: optionalQueryNumber(),
    revenueMin: optionalQueryNumber(),
    revenueMax: optionalQueryNumber(),
    preferredTime: optionalQueryString().pipe(timeOfDayBucketZod.optional()),
    preferredService: optionalQueryString().pipe(mongoObjectIdString.optional()),
    createdFrom: optionalYyyyMmDd(),
    createdTo: optionalYyyyMmDd(),
  },
});

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
    isActive: z.boolean().optional(),
  })
  .strict();

export const customerUpdateBodySchema = z
  .object({
    name: z.string().min(1).max(200).trim().optional(),
    phone: z.string().min(1).max(40).trim().optional(),
    email: optionalEmail,
    notes: z.string().max(10_000).optional(),
    preferences: customerPreferencesBodySchema.optional(),
    isActive: z.boolean().optional(),
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

export const customersBulkStatusBodySchema = z
  .object({
    ids: z.array(mongoObjectIdString).min(1).max(200),
    isActive: z.boolean(),
  })
  .strict();

export const noShowPolicyBodySchema = z
  .object({
    enabled: z.boolean(),
    threshold: z.number().int().min(1).max(20),
  })
  .strict();

const optionalReason = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => (value ? value : undefined));

export const excuseAllNoShowsBodySchema = z
  .object({
    reason: optionalReason,
  })
  .strict();

export const excuseNoShowBodySchema = z
  .object({
    excused: z.boolean(),
    reason: optionalReason,
  })
  .strict();

export const bookingOverrideBodySchema = z
  .object({
    override: z.enum(['auto', 'allow', 'block']),
    reason: optionalReason,
  })
  .strict();

export const noShowAppointmentParamsSchema = z
  .object({
    id: mongoObjectIdString,
    appointmentId: mongoObjectIdString,
  })
  .strict();

export const customersListQuerySchema = z.object({
  search: z.preprocess(
    (v) => (Array.isArray(v) ? v[0] : v),
    z.string().max(200).optional()
  ),
});
