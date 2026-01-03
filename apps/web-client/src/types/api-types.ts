export interface User {
  id: string;
  email: string;
  role: string;
  businessId: string;
  businessSlug: string;
}

export interface Business {
  _id: string;
  name: string;
  slug: string;
  phone?: string;
  address?: string;
}

export interface Customer {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface ServiceDto {
  _id: string;
  name: string;
  colorHex?: string;
}

export type CustomerDto = Customer;

export interface AppointmentDto {
  _id: string;
  start: string;
  end: string;
  status: AppointmentStatus;
  service?: ServiceDto;
  customer?: CustomerDto;
}

export interface AvailableSlotDto {
  start: string; // ISO string
  end: string;   // ISO string
}