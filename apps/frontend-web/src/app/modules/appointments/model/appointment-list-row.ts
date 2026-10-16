/** One row of the paged appointments list. `start` and `end` stay ISO strings. */
export interface AppointmentListRow {
  _id: string;
  customerName: string;
  customerPhone: string;
  customerPreferredTimeOfDay: string | null;
  serviceId: string | null;
  serviceName: string;
  start: string;
  end: string;
  duration: number;
  price: number;
  status: string;
  source: string;
  notes: string;
}

export const APPOINTMENT_LIST_SORT_FIELDS = [
  'start',
  'price',
  'duration',
  'customerName',
  'status',
  'serviceName',
] as const;
