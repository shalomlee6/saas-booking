/** Request body for POST /api/appointments */
export interface CreateAppointmentDto {
  customerId: string;
  serviceId: string;
  start?: string;
  end?: string;
  /** ISO instant; accepted by API alongside `start` / `end`. */
  startTime?: string;
  endTime?: string;
  time?: string;
  date?: string;
  notes?: string;
  price?: number;
  status?: 'pending' | 'confirmed';
}
