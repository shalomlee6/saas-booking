import { z } from 'zod';

const lead = z.union([
  z.literal(0),
  z.literal(30),
  z.literal(60),
  z.literal(120),
  z.literal(180),
  z.literal(360),
  z.literal(720),
  z.literal(1440),
]);

const buffer = z.union([
  z.literal(0),
  z.literal(5),
  z.literal(10),
  z.literal(15),
  z.literal(20),
  z.literal(30),
]);

const activeCap = z.union([z.null(), z.literal(1), z.literal(2), z.literal(3), z.literal(5), z.literal(10)]);

export const bookingRulesBodySchema = z
  .object({
    enabled: z.boolean(),
    minLeadMinutes: lead,
    maxAdvanceDays: z.number().int().min(7).max(365),
    bufferMinutes: buffer,
    onlineDefaultStatus: z.enum(['confirmed', 'pending']),
    maxActiveAppointmentsPerClient: activeCap,
    clientCanCancelOnline: z.boolean(),
    cancellationWindowHours: z.number().int().min(0).max(24 * 30),
  })
  .strict();

const counterSchema = z
  .object({
    enabled: z.boolean(),
    threshold: z.number().int().min(1).max(20),
  })
  .strict();

export const reliabilityBodySchema = z
  .object({
    noShow: counterSchema,
    lateCancellation: counterSchema,
    lateArrival: counterSchema,
    lookback: z.enum(['12months', 'all']),
  })
  .strict();

export type BookingRulesBody = z.infer<typeof bookingRulesBodySchema>;
export type ReliabilityBody = z.infer<typeof reliabilityBodySchema>;

export const settingsResetBodySchema = z
  .object({
    scope: z.enum(['all', 'design', 'booking', 'reliability', 'customers']),
    /** Required for a full factory reset: the owner types "איפוס" or "reset". */
    confirm: z.string().max(40).optional(),
  })
  .strict();

export type SettingsResetBody = z.infer<typeof settingsResetBodySchema>;
