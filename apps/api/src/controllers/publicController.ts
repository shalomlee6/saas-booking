import { Request, Response } from 'express';
import { Business } from '../models/Business';
import { Service } from '../models/Service';
import { Customer } from '../models/Customer';
import { Appointment } from '../models/Appointment';
import jwt from 'jsonwebtoken';


// GET /api/public/:businessSlug/business
export async function getPublicBusiness(req: Request, res: Response) {
  try {
    const { businessSlug } = req.params;
    
    const business = await Business.findOne({ slug: businessSlug });
    
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    res.json({
      businessId: business._id.toString(),
      name: business.name,
      slug: business.slug,
    });
  } catch (err) {
    console.error('Error GET /public/:businessSlug/business:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/public/:businessSlug/services
export async function getPublicServices(req: Request, res: Response) {
  try {
    const { businessSlug } = req.params;
    
    const business = await Business.findOne({ slug: businessSlug });
    
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    const services = await Service.find({
      businessId: business._id,
      isActive: true,
    }).select('_id name durationMinutes price');

    // Map services with default colors
    const defaultColors = ['#FF9DBC', '#6CD6CD', '#A6DFF8', '#F35271'];
    res.json(services.map((s, idx) => ({
      id: s._id.toString(),
      name: s.name,
      durationMin: s.durationMinutes,
      price: s.price,
      colorHex: defaultColors[idx % defaultColors.length],
    })));
  } catch (err) {
    console.error('Error GET /public/:businessSlug/services:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/public/:businessSlug/available-slots
export async function getPublicAvailableSlots(req: Request, res: Response) {
  try {
    const { businessSlug } = req.params;
    const { serviceId, customerId, weekStart } = req.query;

    if (!serviceId) {
      return res.status(400).json({ message: 'serviceId is required' });
    }

    // Resolve business
    const business = await Business.findOne({ slug: businessSlug });
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }
    const businessId = business._id;

    // Load service (verify it belongs to this business)
    const service = await Service.findOne({ _id: serviceId, businessId });
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Determine effective treatment duration and mode
    let durationMinutes: number;
    let mode: 'estimated' | 'personalized';

    if (customerId) {
      // Validate customer belongs to business
      const customer = await Customer.findOne({ _id: customerId, businessId });
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      // Use customer-specific duration if available
      durationMinutes =
        customer.defaultTreatmentDurationMinutes ??
        service.durationMinutes ??
        60;
      mode = 'personalized';
    } else {
      // Use service default duration
      durationMinutes = service.durationMinutes ?? 60;
      mode = 'estimated';
    }

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

    // Business hours
    const dayStartHour = 8;
    const dayEndHour = 20;
    const slotGranularityMinutes = 30;

    // Load existing non-cancelled appointments
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
    const availableSlots: { start: string; end: string; isAvailable: boolean }[] = [];

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
            isAvailable: true,
          });
        }
      }
    }

    // Return slots with metadata
    return res.json({
      slots: availableSlots,
      durationMinutes,
      mode,
    });
  } catch (err) {
    console.error('Error GET /public/:businessSlug/available-slots:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /api/public/:businessSlug/appointments
export async function createPublicAppointment(req: Request, res: Response) {
  try {
    const { businessSlug } = req.params;
    const { serviceId, customerId, start, end } = req.body;

    // Verify client token
    const header = req.headers['authorization'];
    let token: string | undefined;

    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      token = header.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    if (decoded.role !== 'client') {
      return res.status(403).json({ message: 'Invalid token role' });
    }

    // Resolve business
    const business = await Business.findOne({ slug: businessSlug });
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }
    const businessId = business._id;

    // Verify businessId matches token
    if (decoded.businessId !== businessId.toString()) {
      return res.status(403).json({ message: 'Business mismatch' });
    }

    // Validate input
    if (!serviceId || !customerId || !start || !end) {
      return res.status(400).json({
        message: 'serviceId, customerId, start and end are required',
      });
    }

    // Verify customer belongs to business and matches token
    if (decoded.customerId !== customerId) {
      return res.status(403).json({ message: 'Customer mismatch' });
    }

    const customer = await Customer.findOne({ _id: customerId, businessId });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Verify service belongs to business
    const service = await Service.findOne({ _id: serviceId, businessId });
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Validate dates
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    if (startDate >= endDate) {
      return res.status(400).json({ message: 'start must be before end' });
    }

    // Check for collisions with existing appointments
    const conflictingAppointment = await Appointment.findOne({
      businessId,
      start: { $lt: endDate },
      end: { $gt: startDate },
      status: { $ne: 'cancelled' },
    });

    if (conflictingAppointment) {
      return res.status(409).json({ message: 'Time slot is already booked' });
    }

    // Create appointment
    const appointment = await Appointment.create({
      businessId,
      customerId,
      serviceId,
      start: startDate,
      end: endDate,
      status: 'confirmed',
      source: 'client-online',
    });

    return res.status(201).json({
      appointmentId: appointment._id.toString(),
      status: appointment.status,
    });
  } catch (err) {
    console.error('Error POST /public/:businessSlug/appointments:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

