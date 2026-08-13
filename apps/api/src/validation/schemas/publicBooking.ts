import { z } from 'zod';
import {
  businessSlugParam,
  hhMm,
  iso8601CalendarDayOrInstant,
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
  .strip();

export const slugAvailabilityQuerySchema = z
  .object({
    serviceId: mongoObjectIdString,
    date: yyyyMmDd,
  })
  .strip();

export const slugParamsSchema = z
  .object({
    slug: businessSlugParam,
  })
  .strip();

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
    customerPhone: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : v),
      z.string().min(3).max(50).optional()
    ),
  })
  .strip()
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
    const name = data.customerName?.trim();
    if (name && !data.customerPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customerPhone'],
        message: 'customerPhone is required',
      });
    }
  });

export const publicCancelAppointmentParamsSchema = z
  .object({
    appointmentId: mongoObjectIdString,
  })
  .strip();

export const publicCancelAppointmentBodySchema = z
  .object({
    cancellationReason: z
      .string()
      .max(2000)
      .transform((s) => s.trim())
      .refine((s) => s.length > 0, { message: 'cancellationReason is required' }),
  })
  .strip();

/** Legacy POST /api/public/:businessSlug/appointments (Bearer client) */
export const legacyBusinessSlugParamsSchema = z
  .object({
    businessSlug: businessSlugParam,
  })
  .strip();

/** GET /api/public/:businessSlug/available-slots */
export const legacyAvailableSlotsQuerySchema = z
  .object({
    serviceId: mongoObjectIdString,
    customerId: mongoObjectIdString.optional(),
    weekStart: iso8601CalendarDayOrInstant.optional(),
  })
  .strip();

export const legacyPublicCreateAppointmentBodySchema = z
  .object({
    serviceId: mongoObjectIdString,
    customerId: mongoObjectIdString,
    start: iso8601DateTimeWithOffset,
    end: iso8601DateTimeWithOffset,
  })
  .strip()
  .superRefine((data, ctx) => {
    if (new Date(data.start) >= new Date(data.end)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end'],
        message: 'end must be after start',
      });
    }
  });
