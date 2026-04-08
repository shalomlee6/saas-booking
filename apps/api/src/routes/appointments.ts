import { Router } from 'express';
import { Types } from 'mongoose';
import { auth, AuthRequest } from '../middleware/auth';
import { requireBusinessContext } from '../middleware/requireBusinessContext';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody, validateParams, validateQuery } from '../middleware/validateRequest';
import {
  appointmentCreateBodySchema,
  appointmentIdParamsSchema,
  appointmentUpdateBodySchema,
  appointmentsListQuerySchema,
  appointmentsWeekQuerySchema,
  availableSlotsQuerySchema,
} from '../validation/schemas/appointments';
import {
  getAppointmentsList,
  getBusinessAppointmentsForWeek,
  getAvailableSlots,
} from '../controllers/appointmentController';
import { Appointment } from '../models/Appointment';
import { createAppointmentAtomic, assertNoOverlap } from '../services/createAppointmentAtomic';
import { appointmentDocumentToResponseDto } from '../dto/appointmentJson';

export const appointmentsRouter = Router();

appointmentsRouter.use(auth);
appointmentsRouter.use(requireBusinessContext);

appointmentsRouter.get(
  '/week',
  validateQuery(appointmentsWeekQuerySchema),
  getBusinessAppointmentsForWeek
);

appointmentsRouter.get(
  '/available-slots',
  validateQuery(availableSlotsQuerySchema),
  getAvailableSlots
);

appointmentsRouter.get(
  '/',
  validateQuery(appointmentsListQuerySchema),
  getAppointmentsList
);

// POST /api/appointments
appointmentsRouter.post(
  '/',
  validateBody(appointmentCreateBodySchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const businessId = req.effectiveBusinessId!;
    const { customerId, serviceId, start, end, notes } = req.body as {
      customerId: string;
      serviceId: string;
      start: string;
      end: string;
      notes?: string;
    };

    const appointment = await createAppointmentAtomic({
      businessId: new Types.ObjectId(businessId),
      serviceId,
      customerId,
      start: new Date(start),
      end: new Date(end),
      source: 'owner',
      notes,
    });

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
      return res.status(404).json({ message: 'Appointment not found' });
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
        return res.status(400).json({
          message: 'Validation failed',
          errors: [
            {
              path: 'end',
              message: 'end must be after start',
              code: 'custom',
            },
          ],
        });
      }
      await assertNoOverlap(new Types.ObjectId(businessId), newStart, newEnd, id);
    }

    const update: Record<string, unknown> = {};
    if (timesChanged) {
      update.start = newStart;
      update.end = newEnd;
    }
    if (typeof status === 'string') {
      update.status = status;
    }
    if (notes !== undefined) {
      update.notes = notes;
    }

    const appointment = await Appointment.findOneAndUpdate(
      { _id: id, businessId },
      update,
      { new: true }
    );

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    res.json(appointmentDocumentToResponseDto(appointment));
  })
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
      return res.status(404).json({ message: 'Appointment not found' });
    }

    res.json(appointmentDocumentToResponseDto(appointment));
  })
);
