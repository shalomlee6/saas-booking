import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Appointment } from '../models/Appointment';
import { Customer } from '../models/Customer';
import { resolveBusinessIdFromReq } from '../utils/resolveBusinessId';
import mongoose from 'mongoose';

/**
 * GET /api/business/insights
 * Returns basic growth/revenue metrics for the owner dashboard.
 */
export async function getBusinessInsights(req: AuthRequest, res: Response) {
  try {
    const businessId = resolveBusinessIdFromReq(req);
    if (!businessId) {
      return res.status(400).json({ message: 'businessId is required' });
    }
    const businessIdObj = new mongoose.Types.ObjectId(businessId);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [revenueResult, revenueByServiceResult, revenueByWeekdayResult, appointmentsInWindow] = await Promise.all([
      Appointment.aggregate([
        { $match: { businessId: businessIdObj, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$price', 0] } } } },
      ]),
      Appointment.aggregate([
        { $match: { businessId: businessIdObj, status: { $ne: 'cancelled' } } },
        { $group: { _id: '$serviceId', total: { $sum: { $ifNull: ['$price', 0] } } } },
        { $lookup: { from: 'services', localField: '_id', foreignField: '_id', as: 'svc' } },
        { $unwind: { path: '$svc', preserveNullAndEmptyArrays: true } },
        { $project: { total: 1, serviceName: { $ifNull: ['$svc.name', ''] } } },
      ]),
      Appointment.aggregate([
        { $match: { businessId: businessIdObj, status: { $ne: 'cancelled' } } },
        { $project: { weekday: { $dayOfWeek: '$start' }, price: { $ifNull: ['$price', 0] } } },
        { $group: { _id: '$weekday', total: { $sum: '$price' } } },
      ]),
      Appointment.distinct('customerId', {
        businessId: businessIdObj,
        start: { $gte: sixtyDaysAgo },
        status: { $ne: 'cancelled' },
        customerId: { $exists: true, $ne: null },
      }),
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
      { $match: { businessId: businessIdObj, status: { $ne: 'cancelled' }, customerId: { $exists: true, $ne: null } } },
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
    });
  } catch (err) {
    console.error('Error GET /business/insights:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
