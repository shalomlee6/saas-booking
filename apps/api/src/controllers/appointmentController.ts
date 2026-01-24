import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Appointment } from '../models/Appointment';
import { Customer } from '../models/Customer';
import { Service } from '../models/Service';
import { resolveBusinessIdFromReq } from '../utils/resolveBusinessId';

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
      .populate('customerId', 'name phone')
      .populate('serviceId', 'name colorHex')
      .sort({ start: 1 });

    const dtoArray = appointments.map((apt) => {
      // Check if populated (object) vs ObjectId string
      const customerPopulated = apt.customerId && typeof apt.customerId === 'object' && 'name' in apt.customerId
        ? apt.customerId as any
        : null;
      const servicePopulated = apt.serviceId && typeof apt.serviceId === 'object' && 'name' in apt.serviceId
        ? apt.serviceId as any
        : null;

      return {
        _id: apt._id.toString(),
        start: apt.start,
        end: apt.end,
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
            }
          : null,
      };
    });

    return res.json(dtoArray);
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

    const businessId = resolveBusinessIdFromReq(req);

    if (!businessId) {
      return res.status(400).json({ message: 'businessId is required' });
    }

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
      // Check if populated (object) vs ObjectId string
      const customerPopulated = apt.customerId && typeof apt.customerId === 'object' && 'name' in apt.customerId
        ? apt.customerId as any
        : null;
      const servicePopulated = apt.serviceId && typeof apt.serviceId === 'object' && 'name' in apt.serviceId
        ? apt.serviceId as any
        : null;

      return {
        _id: apt._id.toString(),
        start: apt.start.toISOString(),
        end: apt.end.toISOString(),
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

    return res.json(dtoArray);
  } catch (err) {
    console.error('Error GET /appointments/business-week:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export const getAvailableSlots = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const businessId = resolveBusinessIdFromReq(req);

    if (!businessId) {
      return res.status(400).json({ message: 'businessId is required' });
    }

    const { serviceId, customerId, weekStart } = req.query;

    if (!serviceId || !customerId) {
      return res.status(400).json({ message: 'serviceId and customerId are required' });
    }

    // Load customer and service
    const customer = await Customer.findOne({ _id: customerId, businessId });
    const service = await Service.findOne({ _id: serviceId, businessId });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Determine effective treatment duration
    let durationMinutes =
      customer.defaultTreatmentDurationMinutes ??
      service.durationMinutes ??
      60;

    // Compute week range
    let startOfWeek: Date;
    if (weekStart) {
      const parsedDate = new Date(String(weekStart));
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: 'Invalid weekStart date format' });
      }
      startOfWeek = new Date(parsedDate);
      startOfWeek.setHours(0, 0, 0, 0);
    } else {
      startOfWeek = new Date();
      startOfWeek.setHours(0, 0, 0, 0);
    }

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    // Business hours (hard-coded for now)
    const dayStartHour = 8;
    const dayEndHour = 20;
    const slotGranularityMinutes = 30;

    // Load existing non-cancelled appointments for the business that overlap the week range
    const appointments = await Appointment.find({
      businessId,
      start: { $lt: endOfWeek },
      end: { $gt: startOfWeek },
      status: { $ne: 'cancelled' },
    });

    // Calculate number of slots needed
    const numberOfSlots = Math.ceil(durationMinutes / slotGranularityMinutes);

    // Helper function to check if a time slot overlaps with any appointment
    const isSlotOccupied = (slotStart: Date, slotEnd: Date): boolean => {
      return appointments.some((apt) => {
        return apt.start < slotEnd && apt.end > slotStart;
      });
    };

    // Generate available slots for the week
    const availableSlots: { start: string; end: string }[] = [];

    // Iterate through each day in the week
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const currentDay = new Date(startOfWeek);
      currentDay.setDate(startOfWeek.getDate() + dayOffset);

      // Generate half-hour slots for this day
      const slotsForDay: Date[] = [];
      for (let hour = dayStartHour; hour < dayEndHour; hour++) {
        for (let minute = 0; minute < 60; minute += slotGranularityMinutes) {
          const slotTime = new Date(currentDay);
          slotTime.setHours(hour, minute, 0, 0);
          slotsForDay.push(slotTime);
        }
      }

      // Check each potential start slot
      for (let i = 0; i <= slotsForDay.length - numberOfSlots; i++) {
        const slotStart = slotsForDay[i];
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

        // Check if all required consecutive slots are free
        let allSlotsFree = true;
        for (let j = 0; j < numberOfSlots; j++) {
          const checkSlotStart = slotsForDay[i + j];
          const checkSlotEnd = new Date(checkSlotStart.getTime() + slotGranularityMinutes * 60 * 1000);

          if (isSlotOccupied(checkSlotStart, checkSlotEnd)) {
            allSlotsFree = false;
            break;
          }
        }

        // Also check if the full appointment duration doesn't overlap
        if (allSlotsFree && !isSlotOccupied(slotStart, slotEnd)) {
          availableSlots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
          });
        }
      }
    }

    return res.json(availableSlots);
  } catch (err) {
    console.error('Error GET /appointments/available-slots:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

