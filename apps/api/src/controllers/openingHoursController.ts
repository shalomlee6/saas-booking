import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { BusinessSettings } from '../models/BusinessSettings';
import {
  ensureBusinessSettings,
} from '../utils/ensureBusinessSettings';
import { getEffectiveBusinessId } from '../utils/effectiveBusinessId';
import { logger } from '../utils/logger';
import type { IOpeningHours, IOpeningHoursDay, IOpeningHoursRange } from '../models/BusinessSettings';

const HHMM_REGEX = /^([01]?\d|2[0-3]):[0-5]\d$/;

function validateOpeningHoursPayload(body: unknown): { valid: boolean; message?: string; data?: IOpeningHours } {
  if (!body || typeof body !== 'object' || !('openingHours' in body)) {
    return { valid: false, message: 'openingHours is required' };
  }
  const oh = (body as { openingHours: unknown }).openingHours;
  if (!oh || typeof oh !== 'object') {
    return { valid: false, message: 'openingHours must be an object' };
  }
  const slotStepMinutes = (oh as Record<string, unknown>).slotStepMinutes;
  if (typeof slotStepMinutes !== 'number' || slotStepMinutes < 5 || slotStepMinutes > 60) {
    return { valid: false, message: 'openingHours.slotStepMinutes must be between 5 and 60' };
  }
  const days = (oh as Record<string, unknown>).days;
  if (!Array.isArray(days) || days.length !== 7) {
    return { valid: false, message: 'openingHours.days must be an array of length 7' };
  }
  const outDays: IOpeningHoursDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = days[i];
    if (!d || typeof d !== 'object') {
      return { valid: false, message: `openingHours.days[${i}] must be an object` };
    }
    const day = (d as Record<string, unknown>).day;
    const isOpen = (d as Record<string, unknown>).isOpen;
    const ranges = (d as Record<string, unknown>).ranges;
    if (typeof day !== 'number' || day < 0 || day > 6) {
      return { valid: false, message: `openingHours.days[${i}].day must be 0-6` };
    }
    if (typeof isOpen !== 'boolean') {
      return { valid: false, message: `openingHours.days[${i}].isOpen must be boolean` };
    }
    if (!Array.isArray(ranges)) {
      return { valid: false, message: `openingHours.days[${i}].ranges must be an array` };
    }
    const outRanges: IOpeningHoursRange[] = [];
    for (let j = 0; j < ranges.length; j++) {
      const r = ranges[j];
      if (!r || typeof r !== 'object') {
        return { valid: false, message: `openingHours.days[${i}].ranges[${j}] must be { start, end }` };
      }
      const start = (r as Record<string, unknown>).start;
      const end = (r as Record<string, unknown>).end;
      if (typeof start !== 'string' || !HHMM_REGEX.test(start)) {
        return { valid: false, message: `openingHours.days[${i}].ranges[${j}].start must be HH:mm` };
      }
      if (typeof end !== 'string' || !HHMM_REGEX.test(end)) {
        return { valid: false, message: `openingHours.days[${i}].ranges[${j}].end must be HH:mm` };
      }
      const startH = parseInt(start.slice(0, 2), 10);
      const startM = startH * 60 + parseInt(start.slice(3), 10);
      const endH = parseInt(end.slice(0, 2), 10);
      const endM = endH * 60 + parseInt(end.slice(3), 10);
      if (startM >= endM) {
        return { valid: false, message: `openingHours.days[${i}].ranges[${j}]: start must be before end` };
      }
      if (startH < 6) {
        return { valid: false, message: 'Invalid working hours range' };
      }
      if (endH > 23) {
        return { valid: false, message: 'Invalid working hours range' };
      }
      outRanges.push({ start: start as string, end: end as string });
    }
    // Prevent overlapping ranges per day: sort by start, then check end <= next start
    outRanges.sort((a, b) => {
      const aM = parseInt(a.start.slice(0, 2), 10) * 60 + parseInt(a.start.slice(3), 10);
      const bM = parseInt(b.start.slice(0, 2), 10) * 60 + parseInt(b.start.slice(3), 10);
      return aM - bM;
    });
    for (let k = 0; k < outRanges.length - 1; k++) {
      const currEnd = parseInt(outRanges[k].end.slice(0, 2), 10) * 60 + parseInt(outRanges[k].end.slice(3), 10);
      const nextStart = parseInt(outRanges[k + 1].start.slice(0, 2), 10) * 60 + parseInt(outRanges[k + 1].start.slice(3), 10);
      if (currEnd > nextStart) {
        return { valid: false, message: 'Invalid working hours range' };
      }
    }
    outDays.push({ day: day as number, isOpen: isOpen as boolean, ranges: outRanges });
  }
  return {
    valid: true,
    data: { slotStepMinutes, days: outDays },
  };
}

/**
 * PATCH /api/business/settings/opening-hours
 * Auth required. Resolves business by owner (or impersonation). Validates and saves openingHours.
 */
export async function patchOpeningHours(req: AuthRequest, res: Response): Promise<void> {
  try {
    const businessId = getEffectiveBusinessId(req);
    if (!businessId) {
      res.status(403).json({ message: 'Forbidden: business not found for user' });
      return;
    }
    await ensureBusinessSettings(businessId);
    const result = validateOpeningHoursPayload(req.body);
    if (!result.valid || !result.data) {
      res.status(400).json({ message: result.message ?? 'Validation error' });
      return;
    }
    const businessIdObj = new Types.ObjectId(businessId);
    const updated = await BusinessSettings.findOneAndUpdate(
      { businessId: businessIdObj },
      { $set: { openingHours: result.data } },
      { new: true, runValidators: true }
    );
    if (!updated) {
      res.status(404).json({ message: 'Settings not found' });
      return;
    }
    const openingHours = updated.openingHours ?? result.data;
    res.json({ openingHours });
  } catch (err) {
    logger.error('patch_opening_hours_failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ message: 'Internal server error' });
  }
}
