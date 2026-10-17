import { Types, type FilterQuery } from 'mongoose';
import { Appointment, type IAppointment } from '../models/Appointment';
import type { PublicCustomer } from '../types/publicCustomer';

/**
 * A verified session sees the customer's upcoming appointments.
 * An unverified session sees only appointments it created. Older rows have no
 * session id and stay hidden — there is no backfill.
 */
export function visibleUpcomingFilter(
  session: PublicCustomer,
  now = new Date()
): FilterQuery<IAppointment> | null {
  if (!session.customerId) return null;
  return {
    customerId: new Types.ObjectId(session.customerId),
    businessId: new Types.ObjectId(session.businessId),
    status: { $in: ['pending', 'confirmed'] },
    start: { $gte: now },
    ...(session.verified ? {} : { createdBySessionId: session.sessionId }),
  };
}

export function sessionOwnsAppointment(
  session: PublicCustomer,
  apt: { customerId?: Types.ObjectId | string | null; businessId: Types.ObjectId | string; createdBySessionId?: string | null }
): boolean {
  if (!session.customerId) return false;
  if (apt.customerId?.toString() !== session.customerId) return false;
  if (apt.businessId.toString() !== session.businessId) return false;
  if (session.verified) return true;
  return apt.createdBySessionId === session.sessionId;
}

export async function countVisibleUpcoming(session: PublicCustomer, now = new Date()): Promise<number> {
  const filter = visibleUpcomingFilter(session, now);
  if (!filter) return 0;
  return Appointment.countDocuments(filter);
}
