import type { Appointment, AppointmentListItem } from '../model/appointment';
import type { CreateAppointmentDto } from './create-appointment.dto';
import { businessWallTimeToUtc } from '../utils/calendar.utils';

type UnknownRecord = Record<string, unknown>;

function parseDateValue(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value as string | number);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function getStringField(source: UnknownRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = source[key];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

/**
 * Maps list/read DTOs to the Appointment model used by calendar UI.
 * Backward-compatible with current list shape and tolerant to normalized aliases.
 */
export function mapAppointmentDtoToModel(dto: AppointmentListItem | UnknownRecord): Appointment | null {
  const raw = dto as UnknownRecord;
  const start = parseDateValue(raw['start'] ?? raw['startAt'] ?? raw['startTime']);
  const end = parseDateValue(raw['end'] ?? raw['endAt'] ?? raw['endTime']);
  if (!start || !end) return null;

  const appointmentId = getStringField(raw, ['appointmentId', '_id', 'id']);
  if (!appointmentId) return null;

  return {
    _id: appointmentId,
    appointmentId: getStringField(raw, ['appointmentId']),
    start,
    end,
    status: getStringField(raw, ['status']) ?? 'pending',
    price: typeof raw['price'] === 'number' ? raw['price'] : undefined,
    durationMinutes:
      typeof raw['durationMinutes'] === 'number' ? raw['durationMinutes'] : undefined,
    serviceName: getStringField(raw, ['serviceName']) ?? undefined,
    customerName: getStringField(raw, ['customerName']) ?? undefined,
    customerPhone: (raw['customerPhone'] as string | null | undefined) ?? undefined,
    notes: getStringField(raw, ['notes']) ?? undefined,
  };
}

/** Parses `datetime-local` style `YYYY-MM-DDTHH:mm` (optional seconds) as naive components. */
function parseNaiveDateAndTime(value: string): { date: string; time: string } | null {
  const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return { date: m[1], time: `${m[2]}:${m[3]}` };
}

/**
 * Builds create DTO from business-calendar date + slot time while preserving
 * existing API fields (`start`, `end`, optional `date`, `time`, `notes`).
 * `start`/`end` are ISO instants for the intended business-local wall times.
 */
export function buildCreateAppointmentDtoFromDateTime(args: {
  customerId: string;
  serviceId: string;
  date: string;
  time: string;
  durationMinutes: number;
  notes?: string;
  /** IANA timezone for the active business (e.g. from AuthService.businessTimezone). */
  businessTimezone: string;
}): CreateAppointmentDto | null {
  const startDate = businessWallTimeToUtc(args.date, args.time, args.businessTimezone);
  if (!startDate) return null;
  const endDate = new Date(startDate.getTime() + args.durationMinutes * 60 * 1000);

  return {
    customerId: args.customerId.trim(),
    serviceId: args.serviceId.trim(),
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    time: args.time,
    date: args.date,
    notes: args.notes?.trim() || undefined,
  };
}

/**
 * Builds create DTO from `datetime-local` strings interpreted as **business-local** wall
 * components (not the browser's local timezone).
 */
export function buildCreateAppointmentDtoFromRange(args: {
  customerId: string;
  serviceId: string;
  startLocal: string;
  endLocal: string;
  notes?: string;
  businessTimezone: string;
}): CreateAppointmentDto | null {
  const s = parseNaiveDateAndTime(args.startLocal);
  const e = parseNaiveDateAndTime(args.endLocal);
  if (!s || !e) return null;
  const startDate = businessWallTimeToUtc(s.date, s.time, args.businessTimezone);
  const endDate = businessWallTimeToUtc(e.date, e.time, args.businessTimezone);
  if (!startDate || !endDate) return null;
  return {
    customerId: args.customerId.trim(),
    serviceId: args.serviceId.trim(),
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    notes: args.notes?.trim() || undefined,
  };
}

/**
 * Centralized update payload builder for appointment update endpoint.
 */
export function buildUpdateAppointmentDto(body: Partial<{
  start: string;
  end: string;
  status: string;
  notes: string;
}>): Partial<{ start: string; end: string; status: string; notes: string }> {
  const out: Partial<{ start: string; end: string; status: string; notes: string }> = {};
  if (body.start) out.start = body.start;
  if (body.end) out.end = body.end;
  if (body.status) out.status = body.status;
  if (body.notes != null) out.notes = body.notes;
  return out;
}
