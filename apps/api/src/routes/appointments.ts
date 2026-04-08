import { Router } from 'express';
import { Types } from 'mongoose';
import { auth, AuthRequest } from '../middleware/auth';
import { requireBusinessContext } from '../middleware/requireBusinessContext';
import { asyncHandler } from '../utils/asyncHandler';
import {
  getAppointmentsList,
  getBusinessAppointmentsForWeek,
  getAvailableSlots,
} from '../controllers/appointmentController';
import { Appointment } from '../models/Appointment';
import { createAppointmentAtomic, assertNoOverlap } from '../services/createAppointmentAtomic';

export const appointmentsRouter = Router();

appointmentsRouter.use(auth);
appointmentsRouter.use(requireBusinessContext);

// GET /api/appointments/week
appointmentsRouter.get('/week', getBusinessAppointmentsForWeek);

// GET /api/appointments/available-slots?serviceId=...&customerId=...&weekStart=...
appointmentsRouter.get('/available-slots', getAvailableSlots);

// GET /api/appointments?from=2025-01-01&to=2025-01-02
appointmentsRouter.get('/', getAppointmentsList);

function hasTimezoneOffset(iso: string): boolean {
  return /Z$|[+-]\d{2}:\d{2}$/.test(iso);
}

// POST /api/appointments
appointmentsRouter.post(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const businessId = req.effectiveBusinessId!;
    const { customerId, serviceId, start, end, notes } = req.body;

    if (!customerId || !serviceId || !start || !end) {
      return res.status(400).json({
        message: 'customerId, serviceId, start and end are required',
      });
    }

    if (typeof start !== 'string' || !hasTimezoneOffset(start)) {
      return res.status(400).json({
        message:
          'start must be an ISO 8601 string with timezone offset (e.g. 2026-02-26T13:00:00+02:00 or 2026-02-26T11:00:00Z)',
      });
    }
    if (typeof end !== 'string' || !hasTimezoneOffset(end)) {
      return res.status(400).json({
        message:
          'end must be an ISO 8601 string with timezone offset (e.g. 2026-02-26T14:00:00+02:00 or 2026-02-26T12:00:00Z)',
      });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    const appointment = await createAppointmentAtomic({
      businessId: new Types.ObjectId(businessId),
      serviceId,
      customerId,
      start: startDate,
      end: endDate,
      source: 'owner',
      notes,
    });

    return res.status(201).json(appointment);
  })
);

// PUT /api/appointments/:id
appointmentsRouter.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const businessId = req.effectiveBusinessId!;
    const { id } = req.params;
    const { start, end, status, notes } = req.body;

    if (start !== undefined) {
      if (typeof start !== 'string' || !hasTimezoneOffset(start)) {
        return res.status(400).json({
          message:
            'start must be an ISO 8601 string with timezone offset (e.g. 2026-02-26T13:00:00+02:00 or 2026-02-26T11:00:00Z)',
        });
      }
    }
    if (end !== undefined) {
      if (typeof end !== 'string' || !hasTimezoneOffset(end)) {
        return res.status(400).json({
          message:
            'end must be an ISO 8601 string with timezone offset (e.g. 2026-02-26T14:00:00+02:00 or 2026-02-26T12:00:00Z)',
        });
      }
    }

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

    res.json(appointment);
  })
);

// DELETE /api/appointments/:id (ב-MVP: להפוך ל-cancelled)
appointmentsRouter.delete(
  '/:id',
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

    res.json(appointment);
  })
);
