import { z } from 'zod';
import { mongoObjectIdString } from '../primitives';
import {
  createEntityListQuerySchema,
  optionalQueryNumber,
  optionalQueryString,
} from '../../listQuery/schema';

/** Sort fields the paged services list accepts. Metric fields are owner-only at request time. */
export const SERVICE_LIST_SORT_FIELDS = [
  'name',
  'price',
  'duration',
  'bookings',
  'revenue',
  'averageActualPrice',
  'revenuePerHour',
  'lastBooking',
  'createdAt',
] as const;

export const SERVICE_METRIC_SORT_FIELDS = [
  'bookings',
  'revenue',
  'averageActualPrice',
  'revenuePerHour',
  'lastBooking',
] as const;

export const servicesPagedQuerySchema = createEntityListQuerySchema({
  defaultSort: 'name',
  sortableFields: SERVICE_LIST_SORT_FIELDS,
  rangePairs: [
    { min: 'priceMin', max: 'priceMax' },
    { min: 'durationMin', max: 'durationMax' },
    { min: 'bookingsMin', max: 'bookingsMax' },
    { min: 'revenueMin', max: 'revenueMax' },
  ],
  filters: {
    status: optionalQueryString().pipe(z.enum(['all', 'active', 'inactive']).optional()),
    priceMin: optionalQueryNumber(),
    priceMax: optionalQueryNumber(),
    durationMin: optionalQueryNumber(),
    durationMax: optionalQueryNumber(),
    bookingsMin: optionalQueryNumber(),
    bookingsMax: optionalQueryNumber(),
    revenueMin: optionalQueryNumber(),
    revenueMax: optionalQueryNumber(),
    activity: optionalQueryString().pipe(
      z.enum(['neverBooked', 'noBookingsIn30', 'noBookingsIn60', 'noBookingsIn90']).optional()
    ),
  },
});

export const servicesBulkStatusBodySchema = z
  .object({
    ids: z.array(mongoObjectIdString).min(1).max(200),
    isActive: z.boolean(),
  })
  .strict();

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
