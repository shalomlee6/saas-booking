import type { UpcomingAppointment } from '../services/public-api.service';

/** Lexicographic YYYY-MM-DD + HH:mm order is chronological. */
export function compareUpcomingAppointments(
  a: UpcomingAppointment,
  b: UpcomingAppointment
): number {
  const dateCmp = a.date.localeCompare(b.date);
  if (dateCmp !== 0) return dateCmp;
  const timeCmp = a.time.localeCompare(b.time);
  if (timeCmp !== 0) return timeCmp;
  return a.id.localeCompare(b.id);
}

export function sortUpcomingAppointments(
  list: UpcomingAppointment[]
): UpcomingAppointment[] {
  return [...list].sort(compareUpcomingAppointments);
}
