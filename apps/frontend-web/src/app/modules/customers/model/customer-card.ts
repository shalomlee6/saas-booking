import type { TimeOfDayBucket } from './customer';

export interface CustomerAppointmentHistoryItem {
  appointmentId: string;
  start: string;
  end: string;
  status: string;
  price?: number;
  durationMinutes?: number;
  serviceName: string;
  notes?: string | null;
}

export interface CustomerAppointmentSummary {
  id: string;
  start: string;
  status: string;
  serviceName: string;
}

export interface CustomerServiceBreakdownEntry {
  serviceId: string;
  serviceName: string;
  count: number;
}

/** All fields here are computed live from the Appointment collection — never stored on Customer. */
export interface CustomerStats {
  totalAppointments: number;
  completedVisits: number;
  cancellations: number;
  /** Heuristic proxy (no explicit `no_show` status exists) — see API's customerStatsService. */
  noShows: number;
  isNewCustomer: boolean;
  lastAppointment: CustomerAppointmentSummary | null;
  nextAppointment: CustomerAppointmentSummary | null;
  visitFrequencyDays: number | null;
  mostBookedServices: CustomerServiceBreakdownEntry[];
  totalRevenue: number;
  averageSpend: number;
  preferredTimeOfDay: TimeOfDayBucket | null;
  recentCancellations: number;
}

export type CustomerInsightCode =
  | 'RETURNS_PERIODICALLY'
  | 'DUE_FOR_REBOOKING'
  | 'FREQUENT_CANCELLATIONS'
  | 'NEW_CUSTOMER'
  | 'HAS_UPCOMING_NO_SHOW_RISK';

export interface CustomerInsight {
  code: CustomerInsightCode;
  severity: 'info' | 'warning';
  data: Record<string, number | string>;
}

export interface CustomerCardStatsResponse {
  stats: CustomerStats;
  insights: CustomerInsight[];
}
