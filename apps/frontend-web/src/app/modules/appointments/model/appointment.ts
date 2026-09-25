/** Populated refs (when not using list DTO) */
export interface AppointmentCustomer {
  _id: string;
  name: string;
  phone?: string;
}

export interface AppointmentService {
  _id: string;
  name: string;
  colorHex?: string;
}

/** Matches the `TimeOfDayBucket` values stored on `Customer.preferences.preferredTimeOfDay`. */
export type TimeOfDayBucket = 'morning' | 'afternoon' | 'evening' | 'night';

/** Flattened list DTO from GET /api/appointments */
export interface AppointmentListItem {
  appointmentId: string;
  start: string;
  end: string;
  status: string;
  price?: number;
  durationMinutes?: number;
  serviceName: string;
  customerName: string;
  customerPhone: string | null;
  customerPreferredTimeOfDay?: TimeOfDayBucket | null;
}

/** Full or list appointment (list has _id set from appointmentId in effect). start/end as Date for calendar layout. */
export interface Appointment {
  _id: string;
  appointmentId?: string;
  customerId?: string | AppointmentCustomer;
  serviceId?: string | AppointmentService;
  customerName?: string;
  customerPhone?: string | null;
  /** Read-only — sourced from the customer's profile, not editable from an appointment. */
  customerPreferredTimeOfDay?: TimeOfDayBucket | null;
  serviceName?: string;
  price?: number;
  durationMinutes?: number;
  start: Date;
  end: Date;
  status: string;
  source?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}
