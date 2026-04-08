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
    start: iso8601DateTimeWithOffset,
    end: iso8601DateTimeWithOffset,
    notes: z.string().max(10_000).optional(),
  })
  .strip()
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
  })
  .strict()
  .superRefine((q, ctx) => {
    if (q.from !== undefined && q.to !== undefined) {
      const a = new Date(q.from).getTime();
      const b = new Date(q.to).getTime();
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
