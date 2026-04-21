import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { Appointment } from '../models/Appointment';
import { Customer } from '../models/Customer';
import { Service } from '../models/Service';
import { NotFoundError, UnauthorizedError, ValidationError } from '../errors/httpErrors';
import { getEffectiveBusinessId } from '../utils/effectiveBusinessId';
import { toIsoUtcString } from '../dto/datetime';
import { computeOwnerAvailableSlots } from '../services/appointmentQueryService';
import { assertNoOverlap } from '../services/createAppointmentAtomic';
import { assertAppointmentWithinSchedule } from '../services/appointmentScheduleRules';
import { appointmentDocumentToResponseDto } from '../dto/appointmentJson';

function requireBusinessId(req: AuthRequest): string {
  const businessId = getEffectiveBusinessId(req);
  if (!businessId) {
    throw new ValidationError('businessId is required');
  }
  return businessId;
}

/** Inclusive calendar days after `start` covered by [start, end) when end = addDays(start, span + 1). */
const DEFAULT_LIST_SPAN_DAYS = 30;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addCalendarDays(base: Date, days: number): Date {
  const out = new Date(base);
  out.setDate(out.getDate() + days);
  return out;
}

/** GET /api/appointments - list for owner dashboard; flattened DTO, sort start ASC */
export async function getAppointmentsList(req: AuthRequest, res: Response): Promise<void> {
  const businessId = requireBusinessId(req);
  const q = req.query as {
    from?: string;
    to?: string;
    startDate?: string;
    endDate?: string;
  };
  const fromParam = q.from ?? q.startDate;
  const toParam = q.to ?? q.endDate;

  const defaultStart = startOfLocalDay(new Date());
  const defaultEnd = addCalendarDays(defaultStart, DEFAULT_LIST_SPAN_DAYS + 1);

  let start: Date;
  let end: Date;

  if (fromParam && toParam) {
    start = new Date(fromParam);
    end = new Date(toParam);
  } else if (fromParam) {
    start = new Date(fromParam);
    end = addCalendarDays(start, DEFAULT_LIST_SPAN_DAYS + 1);
  } else if (toParam) {
    end = new Date(toParam);
    start = addCalendarDays(end, -(DEFAULT_LIST_SPAN_DAYS + 1));
  } else {
    start = defaultStart;
    end = defaultEnd;
  }

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

/** Populated lean appointment → owner detail JSON (GET one, POST create response). */
export function leanAppointmentToOwnerDetailDto(apt: Record<string, unknown>): Record<string, unknown> {
  const customer = apt.customerId as { _id?: Types.ObjectId; name?: string; phone?: string } | null;
  const service = apt.serviceId as {
    _id?: Types.ObjectId;
    name?: string;
    durationMinutes?: number;
    price?: number;
  } | null;

  const customerName =
    (customer?.name as string | undefined) ??
    (typeof apt.customerName === 'string' ? apt.customerName : '') ??
    '';
  const customerPhone =
    (customer?.phone as string | undefined) ??
    (typeof apt.customerPhone === 'string' ? apt.customerPhone : null);

  return {
    appointmentId: String(apt._id),
    customerId: customer?._id?.toString() ?? null,
    serviceId: service?._id?.toString() ?? String(apt.serviceId),
    customerName,
    customerPhone,
    serviceName: service?.name ?? '',
    durationMinutes: apt.durationMinutes ?? service?.durationMinutes ?? 30,
    price: apt.price ?? service?.price ?? undefined,
    start: toIsoUtcString(apt.start as Date),
    end: toIsoUtcString(apt.end as Date),
    status: apt.status,
    notes: apt.notes ?? null,
  };
}

/** GET /api/appointments/:id — single appointment for edit/detail (flattened + ids). */
export async function getAppointmentById(req: AuthRequest, res: Response): Promise<void> {
  const businessId = requireBusinessId(req);
  const { id } = req.params as { id: string };

  const apt = await Appointment.findOne({ _id: id, businessId })
    .populate('customerId', 'name phone')
    .populate('serviceId', 'name durationMinutes price')
    .lean();

  if (!apt) {
    throw new NotFoundError('Appointment not found');
  }

  res.json(leanAppointmentToOwnerDetailDto(apt as Record<string, unknown>));
}

type PatchBody = {
  customerId?: string;
  serviceId?: string;
  start?: string;
  end?: string;
  price?: number;
  status?: string;
  notes?: string;
};

/** PATCH /api/appointments/:id — update fields; recalc end when start or service changes and end omitted. */
export async function patchAppointmentById(req: AuthRequest, res: Response): Promise<void> {
  const businessId = requireBusinessId(req);
  const { id } = req.params as { id: string };
  const body = req.body as PatchBody;

  const existing = await Appointment.findOne({ _id: id, businessId });
  if (!existing) {
    throw new NotFoundError('Appointment not found');
  }

  const bid = new Types.ObjectId(businessId);
  const nextServiceId = body.serviceId ?? existing.serviceId.toString();
  const service = await Service.findOne({ _id: nextServiceId, businessId: bid });
  if (!service) {
    throw new NotFoundError('Service not found');
  }

  if (body.customerId !== undefined) {
    const cust = await Customer.findOne({ _id: body.customerId, businessId: bid });
    if (!cust) {
      throw new NotFoundError('Customer not found');
    }
  }

  let nextStart = body.start !== undefined ? new Date(body.start) : existing.start;
  let nextEnd = body.end !== undefined ? new Date(body.end) : existing.end;

  const serviceIdChanged =
    body.serviceId !== undefined && body.serviceId !== existing.serviceId.toString();
  const startChanged = body.start !== undefined;
  const endProvided = body.end !== undefined;

  if ((startChanged || serviceIdChanged) && !endProvided) {
    const dur = service.durationMinutes ?? 30;
    nextEnd = new Date(nextStart.getTime() + dur * 60 * 1000);
  }

  if (nextStart.getTime() >= nextEnd.getTime()) {
    throw new ValidationError('Validation failed', [
      { path: 'end', message: 'end must be after start', code: 'custom' },
    ]);
  }

  const windowChanged =
    nextStart.getTime() !== existing.start.getTime() ||
    nextEnd.getTime() !== existing.end.getTime();

  if (windowChanged) {
    await assertAppointmentWithinSchedule(bid, nextStart, nextEnd);
    await assertNoOverlap(bid, nextStart, nextEnd, id);
  }

  const update: Record<string, unknown> = {
    serviceId: new Types.ObjectId(nextServiceId),
    start: nextStart,
    end: nextEnd,
    durationMinutes: service.durationMinutes ?? 30,
  };

  if (body.customerId !== undefined) {
    const cust = await Customer.findOne({ _id: body.customerId, businessId: bid }).lean();
    if (cust) {
      update.customerId = cust._id;
      update.customerName = cust.name;
      update.customerPhone = cust.phone;
    }
  }

  if (body.price !== undefined) {
    update.price = body.price;
  } else if (serviceIdChanged) {
    update.price = service.price;
  }

  if (body.status !== undefined) {
    update.status = body.status;
  }
  if (body.notes !== undefined) {
    update.notes = body.notes === '' ? undefined : body.notes;
  }

  const appointment = await Appointment.findOneAndUpdate({ _id: id, businessId: bid }, update, {
    new: true,
  });

  if (!appointment) {
    throw new NotFoundError('Appointment not found');
  }

  res.json(appointmentDocumentToResponseDto(appointment));
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
