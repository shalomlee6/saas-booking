import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Appointment } from '../models/Appointment';
import { Customer } from '../models/Customer';
import { getEffectiveBusinessId } from '../utils/effectiveBusinessId';
import mongoose from 'mongoose';

type InsightsPeriod = 'week' | 'month' | 'year';

function parseInsightsPeriod(query: unknown): InsightsPeriod {
  const p = typeof query === 'string' ? query.toLowerCase() : '';
  if (p === 'week' || p === 'month' || p === 'year') return p;
  return 'month';
}

/** Start of the current calendar week (Sunday 00:00), month, or year in server local time. */
function periodStart(period: InsightsPeriod): Date {
  const now = new Date();
  if (period === 'year') {
    return new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  }
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/**
 * GET /api/business/insights
 * Returns basic growth/revenue metrics for the owner dashboard.
 * Query: `period=week|month|year` (default month) — filters revenue charts and in-period appointment counts.
 */
export async function getBusinessInsights(req: AuthRequest, res: Response) {
  try {
    const businessId = getEffectiveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: 'businessId is required' });
    }
    const businessIdObj = new mongoose.Types.ObjectId(businessId);
    const period = parseInsightsPeriod(req.query?.period);
    const rangeStart = periodStart(period);
    const matchPeriod = {
      businessId: businessIdObj,
      status: { $ne: 'cancelled' },
      start: { $gte: rangeStart },
    };

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [revenueResult, revenueByServiceResult, revenueByWeekdayResult, appointmentsInWindow, appointmentsCount] =
      await Promise.all([
      Appointment.aggregate([
        { $match: matchPeriod },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$price', 0] } } } },
      ]),
      Appointment.aggregate([
        { $match: matchPeriod },
        { $group: { _id: '$serviceId', total: { $sum: { $ifNull: ['$price', 0] } } } },
        { $lookup: { from: 'services', localField: '_id', foreignField: '_id', as: 'svc' } },
        { $unwind: { path: '$svc', preserveNullAndEmptyArrays: true } },
        { $project: { total: 1, serviceName: { $ifNull: ['$svc.name', ''] } } },
      ]),
      Appointment.aggregate([
        { $match: matchPeriod },
        { $project: { weekday: { $dayOfWeek: '$start' }, price: { $ifNull: ['$price', 0] } } },
        { $group: { _id: '$weekday', total: { $sum: '$price' } } },
      ]),
      Appointment.distinct('customerId', {
        businessId: businessIdObj,
        start: { $gte: sixtyDaysAgo },
        status: { $ne: 'cancelled' },
        customerId: { $exists: true, $ne: null },
      }),
      Appointment.countDocuments(matchPeriod),
    ]);

    const totalRevenue = revenueResult[0]?.total ?? 0;
    const revenueByService = revenueByServiceResult.map((r: { serviceName?: string; total: number }) => ({
      serviceName: r.serviceName ?? '',
      total: r.total,
    }));
    const revenueByWeekday = revenueByWeekdayResult.map((r: { _id: number; total: number }) => ({
      weekday: r._id,
      total: r.total,
    }));

    const activeCustomerIds = new Set((appointmentsInWindow as mongoose.Types.ObjectId[]).filter(Boolean).map(String));
    const allCustomers = await Customer.find({ businessId: businessIdObj }).select('_id').lean();
    const inactiveCustomersCount = allCustomers.filter((c) => !activeCustomerIds.has(c._id.toString())).length;

    const topCustomersAgg = await Appointment.aggregate([
      {
        $match: {
          ...matchPeriod,
          customerId: { $exists: true, $ne: null },
        },
      },
      { $group: { _id: '$customerId', total: { $sum: { $ifNull: ['$price', 0] } } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'cust' } },
      { $unwind: { path: '$cust', preserveNullAndEmptyArrays: true } },
      { $project: { total: 1, name: { $ifNull: ['$cust.name', ''] } } },
    ]);
    const topCustomers = topCustomersAgg.map((r: { name?: string; total: number }) => ({
      name: r.name ?? '',
      total: r.total,
    }));

    return res.json({
      totalRevenue,
      revenueByService,
      revenueByWeekday,
      inactiveCustomersCount,
      topCustomers,
      appointmentsCount,
      period,
    });
  } catch (err) {
    console.error('Error GET /business/insights:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
