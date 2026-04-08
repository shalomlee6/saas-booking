import { z } from 'zod';
import {
  iso8601DateTimeWithOffset,
  mongoObjectIdString,
} from '../primitives';

export const appointmentStatusEnum = z.enum([
  'pending',
  'confirmed',
  'completed',
  'cancelled',
]);

export const appointmentCreateBodySchema = z
  .object({
    customerId: mongoObjectIdString,
    serviceId: mongoObjectIdString,
    start: iso8601DateTimeWithOffset,
    end: iso8601DateTimeWithOffset,
    notes: z.string().max(10_000).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const a = new Date(data.start).getTime();
    const b = new Date(data.end).getTime();
    if (a >= b) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end'],
        message: 'end must be after start',
      });
    }
  });

export const appointmentUpdateBodySchema = z
  .object({
    start: iso8601DateTimeWithOffset.optional(),
    end: iso8601DateTimeWithOffset.optional(),
    status: appointmentStatusEnum.optional(),
    notes: z.string().max(10_000).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.start !== undefined && data.end !== undefined) {
      if (new Date(data.start) >= new Date(data.end)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['end'],
          message: 'end must be after start',
        });
      }
    }
  });

export const appointmentIdParamsSchema = z
  .object({
    id: mongoObjectIdString,
  })
  .strict();

/** GET /api/appointments/week — no query params */
export const appointmentsWeekQuerySchema = z.object({}).strict();

/** GET /api/appointments — optional ISO 8601 bounds */
export const appointmentsListQuerySchema = z
  .object({
    from: z.string().min(1).optional(),
    to: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((q, ctx) => {
    if (q.from !== undefined && Number.isNaN(Date.parse(q.from))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['from'],
        message: 'Must be a valid ISO 8601 date string',
      });
    }
    if (q.to !== undefined && Number.isNaN(Date.parse(q.to))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to'],
        message: 'Must be a valid ISO 8601 date string',
      });
    }
  });

export const availableSlotsQuerySchema = z
  .object({
    serviceId: mongoObjectIdString,
    customerId: mongoObjectIdString,
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
