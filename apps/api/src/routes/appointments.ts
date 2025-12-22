import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { Appointment } from '../models/Appointment';
import { getMyAppointmentsForRange, getBusinessAppointmentsForWeek, getAvailableSlots } from '../controllers/appointmentController';

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
appointmentsRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId!;
    const { from, to } = req.query;

    const start = from ? new Date(String(from)) : new Date();
    const end = to ? new Date(String(to)) : new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const appointments = await Appointment.find({
      businessId,
      start: { $gte: start, $lt: end },
    })
      .populate('customerId')
      .populate('serviceId')
      .sort({ start: 1 });

    res.json(appointments);
  } catch (err) {
    console.error('Error GET /appointments:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

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

    // בעתיד: לבדוק שאין התנגשות תורים
    const appointment = await Appointment.create({
      businessId,
      customerId,
      serviceId,
      start,
      end,
      status: 'confirmed',
      source: 'owner',
      notes,
    });

    res.status(201).json(appointment);
  } catch (err) {
    console.error('Error POST /appointments:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/appointments/:id
appointmentsRouter.put('/:id', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId!;
    const { id } = req.params;
    const { start, end, status, notes } = req.body;

    const appointment = await Appointment.findOneAndUpdate(
      { _id: id, businessId },
      { start, end, status, notes },
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
