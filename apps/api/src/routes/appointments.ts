import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { DateTime } from 'luxon';
import {
  getAppointmentsList,
  getMyAppointmentsForRange,
  getBusinessAppointmentsForWeek,
  getAvailableSlots,
} from '../controllers/appointmentController';
import { Appointment } from '../models/Appointment';
import {
  createAppointmentAtomic,
  AppointmentError,
  assertNoOverlap,
} from '../services/createAppointmentAtomic';

export const appointmentsRouter = Router();

// Apply auth middleware to all routes
appointmentsRouter.use(auth);

// GET /api/appointments/my?from=2025-01-01&to=2025-01-02
appointmentsRouter.get('/my', getMyAppointmentsForRange);

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
appointmentsRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId!;
    const { customerId, serviceId, start, end, notes } = req.body;

    if (!customerId || !serviceId || !start || !end) {
      return res.status(400).json({
        message: 'customerId, serviceId, start and end are required',
      });
    }

    // Enforce explicit timezone offset on start/end
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

    try {
      const appointment = await createAppointmentAtomic(
        {
          businessId,
          serviceId,
          customerId,
          start: startDate,
          end: endDate,
          source: 'owner',
          notes,
        } as any
      );

      return res.status(201).json(appointment);
    } catch (err: any) {
      if (err instanceof AppointmentError) {
        const body: any = { message: err.message };
        if (err.code) body.code = err.code;
        return res.status(err.status).json(body);
      }
      throw err;
    }
  } catch (err) {
    console.error('Error POST /appointments:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/appointments/:id
appointmentsRouter.put('/:id', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId!;
    const { id } = req.params;
    const { start, end, status, notes } = req.body;

    // Validate timezone offsets if new start/end provided
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
      try {
        await assertNoOverlap(businessId as any, newStart, newEnd, id);
      } catch (err: any) {
        if (err instanceof AppointmentError) {
          const body: any = { message: err.message };
          if (err.code) body.code = err.code;
          return res.status(err.status).json(body);
        }
        throw err;
      }
    }

    const update: any = {};
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
  } catch (err) {
    console.error('Error PUT /appointments/:id:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/appointments/:id (ב-MVP: להפוך ל-cancelled)
appointmentsRouter.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId!;
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
  } catch (err) {
    console.error('Error DELETE /appointments/:id:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


/** Parse dateStr (YYYY-MM-DD) + timeStr (HH:mm) in business timezone and return UTC Date */
function toUtcDate(dateStr: string, timeStr: string, timezone: string): Date {
  const [h, m] = timeStr.split(':').map((s) => Number(s));
  const local = DateTime.fromISO(dateStr, { zone: timezone }).set({
    hour: h,
    minute: m,
    second: 0,
    millisecond: 0,
  });

  if (!local.isValid) {
    throw new Error(`Invalid date/time: ${dateStr} ${timeStr} (${timezone})`);
  }

  return local.toUTC().toJSDate();
}
