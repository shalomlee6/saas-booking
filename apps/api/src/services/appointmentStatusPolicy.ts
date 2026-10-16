import type { AppointmentStatus } from '../dto/enums';

/**
 * Cross-status moves. Staying on the same status is always allowed so a save
 * that resends the current status is not treated as a transition.
 * `cancelled` has no onward status.
 */
const ALLOWED_NEXT: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  completed: ['no_show'],
  no_show: ['completed'],
  cancelled: [],
};

export function isAllowedAppointmentStatusTransition(
  from: AppointmentStatus,
  to: AppointmentStatus
): boolean {
  if (from === to) return true;
  return ALLOWED_NEXT[from].includes(to);
}

/** Statuses the owner may move `from` to, not including `from` itself. */
export function allowedNextAppointmentStatuses(
  from: AppointmentStatus
): readonly AppointmentStatus[] {
  return ALLOWED_NEXT[from];
}
