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
    excludeAppointmentId: mongoObjectIdString.optional(),
  })
  .strip();

export const slugAvailabilityQuerySchema = z
  .object({
    serviceId: mongoObjectIdString,
    date: yyyyMmDd,
    excludeAppointmentId: mongoObjectIdString.optional(),
  })
  .strip();

const birthdayBodySchema = z
  .object({
    day: z.number().int(),
    month: z.number().int(),
  })
  .strict();

export const identifyStartBodySchema = z
  .object({
    phone: z.string().min(1).max(40),
  })
  .strict();

export const identifyVerifyBodySchema = z
  .object({
    phone: z.string().min(1).max(40),
    code: z.string().min(1).max(12),
  })
  .strict();

export const identifyCompleteBodySchema = z
  .object({
    name: z.string().max(200).optional(),
    birthday: birthdayBodySchema.optional(),
  })
  .strict();

export const birthdayFieldBodySchema = z
  .object({
    birthdayField: z.enum(['required', 'optional', 'hidden']),
  })
  .strict();

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
  });

export const publicCancelAppointmentParamsSchema = z
  .object({
    appointmentId: mongoObjectIdString,
  })
  .strip();

export const publicRescheduleAppointmentBodySchema = z
  .object({
    date: yyyyMmDd,
    time: hhMm,
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
