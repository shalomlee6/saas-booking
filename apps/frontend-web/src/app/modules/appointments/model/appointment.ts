/** Populated refs from GET /api/appointments (customerId/serviceId can be objects) */
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

export interface Appointment {
  _id: string;
  customerId: string | AppointmentCustomer;
  serviceId: string | AppointmentService;
  start: string;
  end: string;
  status: string;
  source?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
