import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { AvailabilityOverride } from '../models/AvailabilityOverride';
import { getEffectiveBusinessId } from '../utils/effectiveBusinessId';
import { AVAILABILITY_OVERRIDE_TYPES } from '../dto/enums';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_REGEX = /^([01]?\d|2[0-3]):[0-5]\d$/;

/**
 * GET /api/business/overrides?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function getOverrides(req: AuthRequest, res: Response): Promise<void> {
  try {
    const businessId = getEffectiveBusinessId(req);
    if (!businessId) {
      res.status(403).json({ message: 'Forbidden: business not found for user' });
      return;
    }
    const { from, to } = req.query;
    if (typeof from !== 'string' || typeof to !== 'string') {
      res.status(400).json({ message: 'from and to query params (YYYY-MM-DD) are required' });
      return;
    }
    if (!DATE_REGEX.test(from) || !DATE_REGEX.test(to)) {
      res.status(400).json({ message: 'from and to must be YYYY-MM-DD' });
      return;
    }
    if (from > to) {
      res.status(400).json({ message: 'from must be before or equal to to' });
      return;
    }
    const list = await AvailabilityOverride.find({
      businessId: new Types.ObjectId(businessId),
      date: { $gte: from, $lte: to },
    })
      .sort({ date: 1 })
      .lean();
    res.json(list.map((doc) => ({
      id: (doc as any)._id.toString(),
      businessId: (doc as any).businessId.toString(),
      date: doc.date,
      type: doc.type,
      ranges: doc.ranges ?? [],
      note: doc.note,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    })));
  } catch (err) {
    console.error('Error GET /business/overrides:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * POST /api/business/overrides
 * Body: { date, type, ranges?, note? }. Upsert by businessId + date.
 */
export async function postOverride(req: AuthRequest, res: Response): Promise<void> {
  try {
    const businessId = getEffectiveBusinessId(req);
    if (!businessId) {
      res.status(403).json({ message: 'Forbidden: business not found for user' });
      return;
    }
    const body = req.body as { date?: string; type?: string; ranges?: Array<{ start: string; end: string }>; note?: string };
    const { date, type, ranges, note } = body;
    if (!date || typeof date !== 'string' || !DATE_REGEX.test(date)) {
      res.status(400).json({ message: 'date must be YYYY-MM-DD' });
      return;
    }
    if (!type || !(AVAILABILITY_OVERRIDE_TYPES as readonly string[]).includes(type)) {
      res.status(400).json({ message: 'type must be "closed" or "custom"' });
      return;
    }
    let rangesNormalized: Array<{ start: string; end: string }> = [];
    if (type === 'closed') {
      if (Array.isArray(ranges) && ranges.length > 0) {
        res.status(400).json({ message: 'type "closed" must have empty ranges' });
        return;
      }
    } else {
      if (!Array.isArray(ranges) || ranges.length === 0) {
        res.status(400).json({ message: 'type "custom" must have at least one range' });
        return;
      }
      for (let i = 0; i < ranges.length; i++) {
        const r = ranges[i];
        if (!r || typeof r.start !== 'string' || !HHMM_REGEX.test(r.start)) {
          res.status(400).json({ message: `ranges[${i}].start must be HH:mm` });
          return;
        }
        if (typeof r.end !== 'string' || !HHMM_REGEX.test(r.end)) {
          res.status(400).json({ message: `ranges[${i}].end must be HH:mm` });
          return;
        }
        const startM = parseInt(r.start.slice(0, 2), 10) * 60 + parseInt(r.start.slice(3), 10);
        const endM = parseInt(r.end.slice(0, 2), 10) * 60 + parseInt(r.end.slice(3), 10);
        if (startM >= endM) {
          res.status(400).json({ message: `ranges[${i}]: start must be before end` });
          return;
        }
        rangesNormalized.push({ start: r.start, end: r.end });
      }
    }
    const businessIdObj = new Types.ObjectId(businessId);
    const existing = await AvailabilityOverride.findOne({
      businessId: businessIdObj,
      date,
    });
    const payload = {
      businessId: businessIdObj,
      date,
      type: type as 'closed' | 'custom',
      ranges: rangesNormalized,
      note: note != null ? String(note) : undefined,
    };
    let doc;
    if (existing) {
      doc = await AvailabilityOverride.findByIdAndUpdate(
        existing._id,
        { $set: payload },
        { new: true }
      );
    } else {
      doc = await AvailabilityOverride.create(payload);
    }
    res.status(existing ? 200 : 201).json({
      id: doc!._id.toString(),
      businessId: doc!.businessId.toString(),
      date: doc!.date,
      type: doc!.type,
      ranges: doc!.ranges ?? [],
      note: doc!.note,
      createdAt: doc!.createdAt,
      updatedAt: doc!.updatedAt,
    });
  } catch (err) {
    console.error('Error POST /business/overrides:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * DELETE /api/business/overrides/:id
 */
export async function deleteOverride(req: AuthRequest, res: Response): Promise<void> {
  try {
    const businessId = getEffectiveBusinessId(req);
    if (!businessId) {
      res.status(403).json({ message: 'Forbidden: business not found for user' });
      return;
    }
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ message: 'id is required' });
      return;
    }
    let objectId: Types.ObjectId;
    try {
      objectId = new Types.ObjectId(id);
    } catch {
      res.status(400).json({ message: 'Invalid id' });
      return;
    }
    const doc = await AvailabilityOverride.findOne({
      _id: objectId,
      businessId: new Types.ObjectId(businessId),
    });
    if (!doc) {
      res.status(404).json({ message: 'Override not found' });
      return;
    }
    await AvailabilityOverride.deleteOne({ _id: objectId });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error DELETE /business/overrides/:id:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}
