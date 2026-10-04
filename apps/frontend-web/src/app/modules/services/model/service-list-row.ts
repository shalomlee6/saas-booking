export interface ServiceListRow {
  _id: string;
  name: string;
  description?: string;
  duration: number;
  durationMinutes?: number;
  price?: number;
  isActive: boolean;
  createdAt?: string;
  bookings?: number;
  completedBookings?: number;
  revenue?: number;
  averageActualPrice?: number;
  revenuePerHour?: number;
  lastBooking?: string | null;
  upcomingAppointments?: number;
}

/** Must stay a subset of the API `SERVICE_LIST_SORT_FIELDS` allowlist. */
export const SERVICE_LIST_SORT_FIELDS = [
  'name',
  'price',
  'duration',
  'bookings',
  'revenue',
  'averageActualPrice',
  'revenuePerHour',
  'lastBooking',
  'createdAt',
] as const;
