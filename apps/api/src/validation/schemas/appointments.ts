import { z } from 'zod';
import { appointmentStatusZod } from '../../dto/enums';
import {
  iso8601CalendarDayOrInstant,
  iso8601DateTimeWithOffset,
  mongoObjectIdString,
} from '../primitives';

/** Unknown keys stripped (not rejected) for forward-compatible clients. */
export const appointmentCreateBodySchema = z
  .object({
    customerId: mongoObjectIdString,
    serviceId: mongoObjectIdString,
    start: iso8601DateTimeWithOffset.optional(),
    end: iso8601DateTimeWithOffset.optional(),
    startTime: iso8601DateTimeWithOffset.optional(),
    endTime: iso8601DateTimeWithOffset.optional(),
    notes: z.string().max(10_000).optional(),
    price: z.number().min(0).optional(),
    status: z.enum(['pending', 'confirmed']).optional(),
  })
  .strip()
  .superRefine((data, ctx) => {
    const startRaw = data.start ?? data.startTime;
    const endRaw = data.end ?? data.endTime;
    if (!startRaw) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['start'],
        message: 'start or startTime is required',
      });
    }
    if (!endRaw) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end'],
        message: 'end or endTime is required',
      });
    }
    if (startRaw && endRaw && new Date(startRaw) >= new Date(endRaw)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end'],
        message: 'end must be after start',
      });
    }
  });

/** Unknown keys stripped (not rejected). */
export const appointmentUpdateBodySchema = z
  .object({
    start: iso8601DateTimeWithOffset.optional(),
    end: iso8601DateTimeWithOffset.optional(),
    status: appointmentStatusZod.optional(),
    notes: z.string().max(10_000).optional(),
  })
  .strip()
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

/** PATCH /api/appointments/:id — partial update including customer/service reassignment. */
export const appointmentPatchBodySchema = z
  .object({
    customerId: mongoObjectIdString.optional(),
    serviceId: mongoObjectIdString.optional(),
    start: iso8601DateTimeWithOffset.optional(),
    end: iso8601DateTimeWithOffset.optional(),
    price: z.number().min(0).optional(),
    status: appointmentStatusZod.optional(),
    notes: z.union([z.string().max(10_000), z.literal('')]).optional(),
  })
  .strip()
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

/** GET /api/appointments — optional bounds: instant with offset or YYYY-MM-DD */
export const appointmentsListQuerySchema = z
  .object({
    from: iso8601CalendarDayOrInstant.optional(),
    to: iso8601CalendarDayOrInstant.optional(),
    startDate: iso8601CalendarDayOrInstant.optional(),
    endDate: iso8601CalendarDayOrInstant.optional(),
  })
  .strict()
  .superRefine((q, ctx) => {
    const from = q.from ?? q.startDate;
    const to = q.to ?? q.endDate;
    if (from !== undefined && to !== undefined) {
      const a = new Date(from).getTime();
      const b = new Date(to).getTime();
      if (a >= b) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['to'],
          message: 'to must be after from',
        });
      }
    }
  });

export const availableSlotsQuerySchema = z
  .object({
    serviceId: mongoObjectIdString,
    customerId: mongoObjectIdString,
    weekStart: iso8601CalendarDayOrInstant.optional(),
  })
  .strict();
