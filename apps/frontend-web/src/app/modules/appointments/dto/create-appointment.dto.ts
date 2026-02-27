/** Request body for POST /api/appointments */
export interface CreateAppointmentDto {
  customerId: string;
  serviceId: string;
  start: string;
  end: string;
  time?: string;
  date?: string;
  notes?: string;
}
