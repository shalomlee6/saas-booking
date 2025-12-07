import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Appointment } from '../models/Appointment';

export async function getMyAppointmentsForRange(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const customerId = (req.user as any).customerId;
    const businessId = req.user.businessId;

    if (!customerId) {
      return res.status(400).json({ message: 'customerId is required' });
    }

    if (!businessId) {
      return res.status(400).json({ message: 'businessId is required' });
    }

    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ message: 'from and to query parameters are required' });
    }

    const startDate = new Date(String(from));
    const endDate = new Date(String(to));

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    const appointments = await Appointment.find({
      customerId,
      businessId,
      start: { $gte: startDate, $lte: endDate },
    })
      .sort({ start: 1 });

    return res.json(appointments);
  } catch (err) {
    console.error('Error GET /appointments/my-range:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getBusinessAppointmentsForWeek(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const businessId = req.user.businessId;

    if (!businessId) {
      return res.status(400).json({ message: 'businessId is required' });
    }

    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const appointments = await Appointment.find({
      businessId,
      start: { $gte: now, $lte: nextWeek },
    })
      .populate('customerId', 'name phone')
      .sort({ start: 1 });

    return res.json(appointments?.length ? appointments : []);
  } catch (err) {
    console.error('Error GET /appointments/business-week:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

