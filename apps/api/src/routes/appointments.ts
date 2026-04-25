import { Router } from 'express';
import { Types } from 'mongoose';
import { auth, AuthRequest } from '../middleware/auth';
import { requireBusinessContext } from '../middleware/requireBusinessContext';
import { requireBackofficeRole } from '../middleware/requireBackofficeRole';
import { asyncHandler } from '../utils/asyncHandler';
import { ConflictError, NotFoundError, ValidationError } from '../errors/httpErrors';
import { validateBody, validateParams, validateQuery } from '../middleware/validateRequest';
import {
  appointmentCreateBodySchema,
  appointmentIdParamsSchema,
  appointmentUpdateBodySchema,
  appointmentPatchBodySchema,
  appointmentsListQuerySchema,
  appointmentsWeekQuerySchema,
  availableSlotsQuerySchema,
} from '../validation/schemas/appointments';
import {
  getAppointmentsList,
  getAppointmentById,
  patchAppointmentById,
  getBusinessAppointmentsForWeek,
  getAvailableSlots,
  leanAppointmentToOwnerDetailDto,
} from '../controllers/appointmentController';
import { Appointment } from '../models/Appointment';
import {
  createAppointmentAtomic,
  updateAppointmentAtomic,
} from '../services/createAppointmentAtomic';
import { appointmentDocumentToResponseDto } from '../dto/appointmentJson';
import { isAllowedAppointmentStatusTransition } from '../services/appointmentStatusPolicy';

export const appointmentsRouter = Router();

appointmentsRouter.use(auth);
appointmentsRouter.use(requireBackofficeRole);
appointmentsRouter.use(requireBusinessContext);

appointmentsRouter.get(
  '/week',
  validateQuery(appointmentsWeekQuerySchema),
  asyncHandler(getBusinessAppointmentsForWeek)
);

appointmentsRouter.get(
  '/available-slots',
  validateQuery(availableSlotsQuerySchema),
  asyncHandler(getAvailableSlots)
);

appointmentsRouter.get(
  '/',
  validateQuery(appointmentsListQuerySchema),
  asyncHandler(getAppointmentsList)
);

appointmentsRouter.get(
  '/:id',
  validateParams(appointmentIdParamsSchema),
  asyncHandler(getAppointmentById)
);

// POST /api/appointments
appointmentsRouter.post(
  '/',
  validateBody(appointmentCreateBodySchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const businessId = req.effectiveBusinessId!;
    const body = req.body as {
      customerId: string;
      serviceId: string;
      start?: string;
      end?: string;
      startTime?: string;
      endTime?: string;
      notes?: string;
      price?: number;
      status?: 'pending' | 'confirmed';
    };
    const startStr = body.start ?? body.startTime;
    const endStr = body.end ?? body.endTime;

    const appointment = await createAppointmentAtomic({
      businessId: new Types.ObjectId(businessId),
      serviceId: body.serviceId,
      customerId: body.customerId,
      start: new Date(startStr!),
      end: new Date(endStr!),
      source: 'owner',
      notes: body.notes,
      price: body.price,
      status: body.status,
    });

    const populated = await Appointment.findOne({
      _id: appointment._id,
      businessId: new Types.ObjectId(businessId),
    })
      .populate('customerId', 'name phone')
      .populate('serviceId', 'name durationMinutes price')
      .lean();

    if (populated) {
      return res.status(201).json(leanAppointmentToOwnerDetailDto(populated as Record<string, unknown>));
    }
    return res.status(201).json(appointmentDocumentToResponseDto(appointment));
  })
);

// PUT /api/appointments/:id
appointmentsRouter.put(
  '/:id',
  validateParams(appointmentIdParamsSchema),
  validateBody(appointmentUpdateBodySchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const businessId = req.effectiveBusinessId!;
    const { id } = req.params;
    const { start, end, status, notes } = req.body as {
      start?: string;
      end?: string;
      status?: string;
      notes?: string;
    };

    const existing = await Appointment.findOne({ _id: id, businessId });
    if (!existing) {
      throw new NotFoundError('Appointment not found');
    }

    let newStart = existing.start;
    let newEnd = existing.end;

    if (start !== undefined) {
      newStart = new Date(start);
    }
    if (end !== undefined) {
      newEnd = new Date(end);
    }

    const timesChanged = start !== undefined || end !== undefined;

    if (timesChanged) {
      if (newStart.getTime() >= newEnd.getTime()) {
        throw new ValidationError('Validation failed', [
          {
            path: 'end',
            message: 'end must be after start',
            code: 'custom',
          },
        ]);
      }
    }

    const update: Record<string, unknown> = {};
    if (timesChanged) {
      update.start = newStart;
      update.end = newEnd;
    }
    if (typeof status === 'string') {
      if (
        !isAllowedAppointmentStatusTransition(
          existing.status,
          status as 'pending' | 'confirmed' | 'completed' | 'cancelled'
        )
      ) {
        throw new ConflictError('Invalid appointment status transition');
      }
      update.status = status;
    }
    if (notes !== undefined) {
      update.notes = notes;
    }

    const appointment = await updateAppointmentAtomic({
      businessId: new Types.ObjectId(businessId),
      appointmentId: id,
      nextStart: newStart,
      nextEnd: newEnd,
      update,
      checkWindowConstraints: timesChanged,
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    res.json(appointmentDocumentToResponseDto(appointment));
  })
);

// PATCH /api/appointments/:id — extended update (customer, service, times, price, …)
appointmentsRouter.patch(
  '/:id',
  validateParams(appointmentIdParamsSchema),
  validateBody(appointmentPatchBodySchema),
  asyncHandler(patchAppointmentById)
);

// DELETE /api/appointments/:id (ב-MVP: להפוך ל-cancelled)
appointmentsRouter.delete(
  '/:id',
  validateParams(appointmentIdParamsSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const businessId = req.effectiveBusinessId!;
    const { id } = req.params;

    const appointment = await Appointment.findOneAndUpdate(
      { _id: id, businessId },
      { status: 'cancelled' },
      { new: true }
    );

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    res.json(appointmentDocumentToResponseDto(appointment));
  })
);
