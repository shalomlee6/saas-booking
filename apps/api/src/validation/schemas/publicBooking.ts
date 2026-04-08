import { z } from 'zod';
import {
  businessSlugParam,
  hhMm,
  iso8601DateTimeWithOffset,
  mongoObjectIdString,
  yyyyMmDd,
} from '../primitives';

export const publicAvailabilityQuerySchema = z
  .object({
    businessId: mongoObjectIdString,
    serviceId: mongoObjectIdString,
    date: yyyyMmDd,
  })
  .strict();

export const slugAvailabilityQuerySchema = z
  .object({
    serviceId: mongoObjectIdString,
    date: yyyyMmDd,
  })
  .strict();

export const slugParamsSchema = z
  .object({
    slug: businessSlugParam,
  })
  .strict();

/** POST /api/public/appointments */
export const publicCreateAppointmentBodySchema = z
  .object({
    slug: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : v),
      businessSlugParam.optional()
    ),
    businessId: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : v),
      mongoObjectIdString.optional()
    ),
    serviceId: mongoObjectIdString,
    date: yyyyMmDd,
    time: hhMm,
    customerName: z.string().max(200).optional(),
    customerPhone: z.string().max(50).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasSlug = data.slug !== undefined;
    const hasBid = data.businessId !== undefined;
    if (!hasSlug && !hasBid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['slug'],
        message: 'Either slug or businessId is required',
      });
    }
    if (hasSlug && hasBid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['businessId'],
        message: 'Provide only one of slug or businessId',
      });
    }
  });

export const publicCancelAppointmentParamsSchema = z
  .object({
    appointmentId: mongoObjectIdString,
  })
  .strict();

export const publicCancelAppointmentBodySchema = z
  .object({
    cancellationReason: z
      .string()
      .max(2000)
      .transform((s) => s.trim())
      .refine((s) => s.length > 0, { message: 'cancellationReason is required' }),
  })
  .strict();

/** Legacy POST /api/public/:businessSlug/appointments (Bearer client) */
export const legacyBusinessSlugParamsSchema = z
  .object({
    businessSlug: businessSlugParam,
  })
  .strict();

/** GET /api/public/:businessSlug/available-slots */
export const legacyAvailableSlotsQuerySchema = z
  .object({
    serviceId: mongoObjectIdString,
    customerId: mongoObjectIdString.optional(),
    weekStart: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((q, ctx) => {
    if (q.weekStart !== undefined && Number.isNaN(Date.parse(q.weekStart))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weekStart'],
        message: 'Must be a valid ISO 8601 date string',
      });
    }
  });

export const legacyPublicCreateAppointmentBodySchema = z
  .object({
    serviceId: mongoObjectIdString,
    customerId: mongoObjectIdString,
    start: iso8601DateTimeWithOffset,
    end: iso8601DateTimeWithOffset,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (new Date(data.start) >= new Date(data.end)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end'],
        message: 'end must be after start',
      });
    }
  });
