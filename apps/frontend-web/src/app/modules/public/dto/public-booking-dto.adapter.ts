import type { CreateAppointmentBody } from '../services/public-api.service';

export function toDateKeyLocal(d: Date): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
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
