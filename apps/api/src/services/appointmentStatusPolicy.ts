import type { AppointmentStatus } from '../dto/enums';

const ALLOWED_NEXT: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ['pending', 'confirmed', 'cancelled'],
  confirmed: ['confirmed', 'completed', 'cancelled'],
  completed: ['completed'],
  cancelled: ['cancelled'],
};

export function isAllowedAppointmentStatusTransition(
  from: AppointmentStatus,
  to: AppointmentStatus
): boolean {
  return ALLOWED_NEXT[from].includes(to);
}
