import { toDateKey } from '../../appointments/utils/calendar.utils';
import type { CreateAppointmentBody } from '../services/public-api.service';

/**
 * YYYY-MM-DD for `d` in the business IANA timezone (not the browser's local calendar).
 * Aligns with availability and server booking rules.
 */
export function toDateKeyInBusinessTimezone(d: Date, timeZone: string): string {
  return toDateKey(d, timeZone);
}

/**
 * Builds public booking payload with current API contract.
 * Keeps date/time split unchanged; only centralizes mapping.
 */
export function buildPublicCreateAppointmentBody(args: {
  businessId: string;
  serviceId: string;
  date: string;
  time: string;
  customerName?: string;
  customerPhone?: string;
}): CreateAppointmentBody {
  return {
    businessId: args.businessId,
    serviceId: args.serviceId,
    date: args.date,
    time: args.time,
    customerName: args.customerName?.trim() || undefined,
    customerPhone: args.customerPhone?.trim() || undefined,
  };
}
