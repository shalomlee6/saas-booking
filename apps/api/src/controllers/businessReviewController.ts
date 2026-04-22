import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { BusinessReview } from '../models/BusinessReview';
import { getEffectiveBusinessId } from '../utils/effectiveBusinessId';
import { ForbiddenError, ValidationError } from '../errors/httpErrors';

function assertOwnerReviews(req: AuthRequest): void {
  const can =
    req.user?.role === 'owner' ||
    (req.user?.role === 'super_admin' && req.user?.impersonating === true);
  if (!can) {
    throw new ForbiddenError('Only the business owner can manage testimonials');
  }
}

// GET /api/business/reviews
export async function listBusinessReviews(req: AuthRequest, res: Response): Promise<void> {
  assertOwnerReviews(req);
  const businessId = getEffectiveBusinessId(req);
  if (!businessId) {
    throw new ValidationError('Business ID not found');
  }
  const rows = await BusinessReview.find({ businessId: new Types.ObjectId(businessId) })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({
    items: rows.map((r) => ({
      id: r._id.toString(),
      customerName: r.customerName,
      text: r.text,
      rating: r.rating,
      createdAt: r.createdAt,
    })),
  });
}

// POST /api/business/reviews
export async function createBusinessReview(req: AuthRequest, res: Response): Promise<void> {
  assertOwnerReviews(req);
  const businessId = getEffectiveBusinessId(req);
  if (!businessId) {
    throw new ValidationError('Business ID not found');
  }
  const body = req.body as { customerName?: string; text?: string; rating?: number };
  const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const rating = typeof body.rating === 'number' ? body.rating : NaN;
  if (!customerName || !text || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ message: 'customerName, text, and rating (1–5) are required' });
    return;
  }
  const doc = await BusinessReview.create({
    businessId: new Types.ObjectId(businessId),
    customerName: customerName.slice(0, 120),
    text: text.slice(0, 2000),
    rating: Math.round(rating),
  });
  res.status(201).json({
    id: doc._id.toString(),
    customerName: doc.customerName,
    text: doc.text,
    rating: doc.rating,
    createdAt: doc.createdAt,
  });
}

// DELETE /api/business/reviews/:id
export async function deleteBusinessReview(req: AuthRequest, res: Response): Promise<void> {
  assertOwnerReviews(req);
  const businessId = getEffectiveBusinessId(req);
  if (!businessId) {
    throw new ValidationError('Business ID not found');
  }
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid id' });
    return;
  }
  const result = await BusinessReview.deleteOne({
    _id: id,
    businessId: new Types.ObjectId(businessId),
  });
  if (result.deletedCount === 0) {
    res.status(404).json({ message: 'Review not found' });
    return;
  }
  res.status(204).send();
}
