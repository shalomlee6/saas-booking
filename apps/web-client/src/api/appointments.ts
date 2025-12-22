import { api } from './client';
import type { AvailableSlotDto, AppointmentDto } from '../types/api-types';

export async function fetchAvailableSlots(
  serviceId: string,
  customerId: string,
  weekStart?: string
): Promise<AvailableSlotDto[]> {
  const params = new URLSearchParams({
    serviceId,
    customerId,
  });

  if (weekStart) {
    params.append('weekStart', weekStart);
  }

  const res = await api.get<AvailableSlotDto[]>(`/appointments/available-slots?${params.toString()}`);
  return res.data;
}

export async function fetchWeekAppointments(): Promise<AppointmentDto[]> {
  const res = await api.get<AppointmentDto[]>('/appointments/week');
  return res.data;
}

