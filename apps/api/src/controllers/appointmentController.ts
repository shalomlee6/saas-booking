import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Appointment } from '../models/Appointment';
import { UnauthorizedError, ValidationError } from '../errors/httpErrors';
import { getEffectiveBusinessId } from '../utils/effectiveBusinessId';
import { toIsoUtcString } from '../dto/datetime';
import { computeOwnerAvailableSlots } from '../services/appointmentQueryService';

function requireBusinessId(req: AuthRequest): string {
  const businessId = getEffectiveBusinessId(req);
  if (!businessId) {
    throw new ValidationError('businessId is required');
  }
  return businessId;
}

/** GET /api/appointments - list for owner dashboard; flattened DTO, sort start ASC */
export async function getAppointmentsList(req: AuthRequest, res: Response): Promise<void> {
  const businessId = requireBusinessId(req);
  const q = req.query as { from?: string; to?: string };
  const start = q.from ? new Date(q.from) : new Date();
  const end = q.to
    ? new Date(q.to)
    : new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const appointments = await Appointment.find({
    businessId,
    start: { $gte: start, $lt: end },
  })
    .populate('customerId', 'name phone')
    .populate('serviceId', 'name durationMinutes price')
    .sort({ start: 1 })
    .lean();

  const dtoArray = appointments.map((apt: any) => {
    const customer = apt.customerId;
    const service = apt.serviceId;
    const price = apt.price ?? service?.price ?? undefined;
    const durationMinutes = apt.durationMinutes ?? service?.durationMinutes ?? undefined;
    return {
      appointmentId: apt._id.toString(),
      start: toIsoUtcString(apt.start),
      end: toIsoUtcString(apt.end),
      status: apt.status,
      price,
      durationMinutes,
      serviceName: service?.name ?? '',
      customerName: customer?.name ?? apt.customerName ?? 'לקוחה',
      customerPhone: customer?.phone ?? apt.customerPhone ?? null,
    };
  });

  res.json(dtoArray);
}

export async function getBusinessAppointmentsForWeek(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const businessId = requireBusinessId(req);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfRange = new Date(startOfToday);
  endOfRange.setDate(startOfToday.getDate() + 7);

  const appointments = await Appointment.find({
    businessId,
    start: { $gte: startOfToday, $lt: endOfRange },
    status: { $ne: 'cancelled' },
  })
    .populate('customerId', 'name phone')
    .populate('serviceId', 'name colorHex textColorHex durationMinutes')
    .sort({ start: 1 });

  const dtoArray = appointments.map((apt) => {
    const customerPopulated =
      apt.customerId && typeof apt.customerId === 'object' && 'name' in apt.customerId
        ? (apt.customerId as any)
        : null;
    const servicePopulated =
      apt.serviceId && typeof apt.serviceId === 'object' && 'name' in apt.serviceId
        ? (apt.serviceId as any)
        : null;

    return {
      _id: apt._id.toString(),
      start: toIsoUtcString(apt.start),
      end: toIsoUtcString(apt.end),
      status: apt.status,
      customer: customerPopulated
        ? {
            _id: customerPopulated._id.toString(),
            name: customerPopulated.name,
            phone: customerPopulated.phone,
          }
        : null,
      service: servicePopulated
        ? {
            _id: servicePopulated._id.toString(),
            name: servicePopulated.name,
            colorHex: servicePopulated.colorHex,
            textColorHex: servicePopulated.textColorHex,
          }
        : null,
    };
  });

  res.json(dtoArray);
}

export async function getAvailableSlots(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const businessId = requireBusinessId(req);

  const { serviceId, customerId, weekStart } = req.query as {
    serviceId: string;
    customerId: string;
    weekStart?: string;
  };

  const slots = await computeOwnerAvailableSlots(businessId, {
    serviceId,
    customerId,
    weekStart,
  });

  res.json(slots);
}
