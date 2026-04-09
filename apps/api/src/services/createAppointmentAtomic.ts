import mongoose, { Types, type ClientSession } from 'mongoose';
import { Appointment, type IAppointment } from '../models/Appointment';
import { Service } from '../models/Service';
import type { AppointmentSource } from '../dto/enums';
import { AppointmentError } from './appointmentErrors';
import { assertAppointmentWithinSchedule } from './appointmentScheduleRules';

export type { AppointmentSource };
export { AppointmentError } from './appointmentErrors';

// TODO =>
// NOTE:
// In production MongoDB must run as a replica set.
// Fallback without transaction is for local development only.
export interface CreateAppointmentPayload {
  businessId: Types.ObjectId;
  serviceId: Types.ObjectId | string;
  start: Date;
  end: Date;
  source: AppointmentSource;
  customerId?: Types.ObjectId | string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
}

export interface CreateAppointmentOptions {
  /** If true, require customerId to be present */
  requireCustomerId?: boolean;
  /** When updating an appointment, exclude this id from overlap check */
  excludeAppointmentId?: Types.ObjectId | string;
}

/**
 * Reusable overlap assertion used by both creation and updates.
 * Throws AppointmentError(409, 'SLOT_TAKEN') when a conflicting appointment exists.
 */
export async function assertNoOverlap(
  businessId: Types.ObjectId,
  start: Date,
  end: Date,
  excludeAppointmentId?: Types.ObjectId | string,
  session?: ClientSession
): Promise<void> {
  const overlapQuery: any = {
    businessId,
    status: { $in: ['confirmed', 'pending'] },
    start: { $lt: end },
    end: { $gt: start },
  };

  if (excludeAppointmentId) {
    overlapQuery._id = { $ne: excludeAppointmentId };
  }

  const conflictingQuery = Appointment.findOne(overlapQuery);
  if (session) {
    conflictingQuery.session(session);
  }
  const conflicting = await conflictingQuery;

  if (conflicting) {
    throw new AppointmentError(
      409,
      'Time slot is no longer available',
      'SLOT_TAKEN'
    );
  }
}

/**
 * Atomic appointment creation with overlap protection.
 * Uses MongoDB transaction to ensure that the overlap check and creation
 * happen atomically for a given business (and optional customer).
 */
export async function createAppointmentAtomic(
  payload: CreateAppointmentPayload,
  options: CreateAppointmentOptions = {}
): Promise<IAppointment> {
  const { businessId, serviceId, start, end, source } = payload;
  const { requireCustomerId } = options;

  if (!businessId) {
    throw new AppointmentError(400, 'businessId is required');
  }

  if (!serviceId) {
    throw new AppointmentError(400, 'serviceId is required');
  }

  if (!(start instanceof Date) || isNaN(start.getTime())) {
    throw new AppointmentError(400, 'start must be a valid Date');
  }

  if (!(end instanceof Date) || isNaN(end.getTime())) {
    throw new AppointmentError(400, 'end must be a valid Date');
  }

  if (start >= end) {
    throw new AppointmentError(400, 'start must be before end');
  }

  if (requireCustomerId && !payload.customerId) {
    throw new AppointmentError(400, 'customerId is required');
  }

  // Shared core logic, optionally wrapped in a MongoDB transaction.
  const runCreate = async (session?: ClientSession): Promise<IAppointment> => {
    // Verify service belongs to this business
    const serviceQuery = Service.findOne({ _id: serviceId, businessId });
    if (session) {
      serviceQuery.session(session);
    }
    const service = await serviceQuery;

    if (!service) {
      throw new AppointmentError(404, 'Service not found');
    }

    await assertAppointmentWithinSchedule(businessId, start, end);

    await assertNoOverlap(
      businessId,
      start,
      end,
      options.excludeAppointmentId,
      session
    );

    if (session) {
      const docs = await Appointment.create(
        [
          {
            businessId,
            serviceId,
            customerId: payload.customerId,
            customerName: payload.customerName,
            customerPhone: payload.customerPhone,
            price: service.price,
            durationMinutes: service.durationMinutes ?? 30,
            start,
            end,
            status: 'confirmed',
            source,
            notes: payload.notes,
          },
        ],
        { session }
      );
      return docs[0];
    }

    const created = await Appointment.create({
      businessId,
      serviceId,
      customerId: payload.customerId,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      price: service.price,
      durationMinutes: service.durationMinutes ?? 30,
      start,
      end,
      status: 'confirmed',
      source,
      notes: payload.notes,
    });

    return created;
  };

  const session = await mongoose.startSession();
  try {
    try {
      let created: IAppointment | null = null;

      await session.withTransaction(async () => {
        created = await runCreate(session);
      });

      if (!created) {
        throw new AppointmentError(500, 'Failed to create appointment');
      }

      return created;
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      const codeName = e?.codeName as string | undefined;
      const isTxnUnsupported =
        codeName === 'IllegalOperation' ||
        msg.includes('Transaction numbers are only allowed');

      if (!isTxnUnsupported) {
        throw e;
      }

      // Fallback path for standalone MongoDB (no transactions support)
      return await runCreate(undefined);
    }
  } finally {
    await session.endSession();
  }
}

