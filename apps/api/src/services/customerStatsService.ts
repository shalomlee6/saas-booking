import { Types } from 'mongoose';
import { Appointment } from '../models/Appointment';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { toIsoUtcString } from '../dto/datetime';
import { TIME_OF_DAY_BUCKETS, type TimeOfDayBucket } from '../dto/enums';

/**
 * Source of truth is the Appointment collection — nothing here is ever written back to
 * Customer. `customerId` is optional so the same pipeline can later be reused business-wide
 * (e.g. a dashboard calling `computeCustomerStats({ businessId })` with no customer filter).
 */
export interface CustomerStatsMatch {
  businessId: Types.ObjectId;
  customerId?: Types.ObjectId;
}

export interface CustomerAppointmentSummary {
  id: string;
  start: string;
  status: string;
  serviceName: string;
}

export interface CustomerServiceBreakdownEntry {
  serviceId: string;
  serviceName: string;
  count: number;
}

export interface CustomerStats {
  totalAppointments: number;
  completedVisits: number;
  cancellations: number;
  /**
   * Heuristic proxy, not a hard fact: there is no explicit `no_show` value in
   * APPOINTMENT_STATUSES, so this counts appointments left `pending`/`confirmed` whose
   * end time has already passed. A real status value would make this exact.
   */
  noShows: number;
  isNewCustomer: boolean;
  lastAppointment: CustomerAppointmentSummary | null;
  nextAppointment: CustomerAppointmentSummary | null;
  /** Average days between consecutive completed visits; null if fewer than 2 completed visits. */
  visitFrequencyDays: number | null;
  mostBookedServices: CustomerServiceBreakdownEntry[];
  totalRevenue: number;
  averageSpend: number;
  /**
   * Derived from completed-visit start times in the business's own timezone; null if there
   * are no completed visits. Distinct from Customer.preferences.preferredTimeOfDay, which is
   * manually set by the owner rather than derived from history.
   */
  preferredTimeOfDay: TimeOfDayBucket | null;
  /** Cancellations in the last 90 days — feeds the "cancelled multiple times recently" insight. */
  recentCancellations: number;
}

interface FacetAppointmentRow {
  _id: Types.ObjectId;
  start: Date;
  status: string;
  serviceName: string;
}

interface FacetResult {
  statusCounts: { _id: string; count: number }[];
  noShowCount: { count: number }[];
  recentCancellationCount: { count: number }[];
  lastAppointment: FacetAppointmentRow[];
  nextAppointment: FacetAppointmentRow[];
  completedStats: { _id: null; count: number; totalRevenue: number; starts: Date[] }[];
  mostBookedServices: { serviceId: Types.ObjectId; serviceName: string; count: number }[];
  hourCounts: { _id: number; count: number }[];
}

function toSummary(row: FacetAppointmentRow | undefined): CustomerAppointmentSummary | null {
  if (!row) return null;
  return {
    id: row._id.toString(),
    start: toIsoUtcString(row.start),
    status: row.status,
    serviceName: row.serviceName,
  };
}

/** Maps an hour-of-day (0-23, already in business-local time) to a coarse bucket. */
function hourToBucket(hour: number): TimeOfDayBucket {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

/** Average whole days between consecutive sorted dates; null if fewer than 2. */
function averageIntervalDays(starts: Date[]): number | null {
  if (starts.length < 2) return null;
  const sorted = [...starts].sort((a, b) => a.getTime() - b.getTime());
  let totalMs = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalMs += sorted[i].getTime() - sorted[i - 1].getTime();
  }
  const avgMs = totalMs / (sorted.length - 1);
  return Math.round((avgMs / (24 * 60 * 60 * 1000)) * 10) / 10;
}

const RECENT_CANCELLATION_WINDOW_DAYS = 90;
const MOST_BOOKED_SERVICES_LIMIT = 5;

export async function computeCustomerStats(match: CustomerStatsMatch): Promise<CustomerStats> {
  const { businessId, customerId } = match;
  const now = new Date();
  const recentCutoff = new Date(now.getTime() - RECENT_CANCELLATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const settings = await ensureBusinessSettings(businessId);
  const timezone = settings.localization?.timezone ?? 'Asia/Jerusalem';

  const matchBase: Record<string, unknown> = { businessId };
  if (customerId) matchBase.customerId = customerId;

  const serviceLookupStages = [
    { $lookup: { from: 'services', localField: 'serviceId', foreignField: '_id', as: 'svc' } },
    { $unwind: { path: '$svc', preserveNullAndEmptyArrays: true } },
  ];

  const [facet] = (await Appointment.aggregate([
    { $match: matchBase },
    {
      $facet: {
        statusCounts: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        noShowCount: [
          { $match: { status: { $in: ['pending', 'confirmed'] }, end: { $lt: now } } },
          { $count: 'count' },
        ],
        recentCancellationCount: [
          { $match: { status: 'cancelled', updatedAt: { $gte: recentCutoff } } },
          { $count: 'count' },
        ],
        lastAppointment: [
          { $match: { status: { $ne: 'cancelled' }, start: { $lte: now } } },
          { $sort: { start: -1 } },
          { $limit: 1 },
          ...serviceLookupStages,
          { $project: { start: 1, status: 1, serviceName: { $ifNull: ['$svc.name', ''] } } },
        ],
        nextAppointment: [
          { $match: { status: { $in: ['pending', 'confirmed'] }, start: { $gt: now } } },
          { $sort: { start: 1 } },
          { $limit: 1 },
          ...serviceLookupStages,
          { $project: { start: 1, status: 1, serviceName: { $ifNull: ['$svc.name', ''] } } },
        ],
        completedStats: [
          { $match: { status: 'completed' } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalRevenue: { $sum: { $ifNull: ['$price', 0] } },
              starts: { $push: '$start' },
            },
          },
        ],
        mostBookedServices: [
          { $match: { status: 'completed' } },
          { $group: { _id: '$serviceId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: MOST_BOOKED_SERVICES_LIMIT },
          { $lookup: { from: 'services', localField: '_id', foreignField: '_id', as: 'svc' } },
          { $unwind: { path: '$svc', preserveNullAndEmptyArrays: true } },
          { $project: { _id: 0, serviceId: '$_id', count: 1, serviceName: { $ifNull: ['$svc.name', ''] } } },
        ],
        hourCounts: [
          { $match: { status: 'completed' } },
          { $group: { _id: { $hour: { date: '$start', timezone } }, count: { $sum: 1 } } },
        ],
      },
    },
  ])) as FacetResult[];

  const statusCountMap = new Map(facet.statusCounts.map((s) => [s._id, s.count]));
  const totalAppointments = facet.statusCounts.reduce((sum, s) => sum + s.count, 0);
  const completedVisits = statusCountMap.get('completed') ?? 0;
  const cancellations = statusCountMap.get('cancelled') ?? 0;
  const noShows = facet.noShowCount[0]?.count ?? 0;
  const recentCancellations = facet.recentCancellationCount[0]?.count ?? 0;

  const completed = facet.completedStats[0];
  const totalRevenue = completed?.totalRevenue ?? 0;
  const averageSpend = completed && completed.count > 0 ? totalRevenue / completed.count : 0;
  const visitFrequencyDays = completed ? averageIntervalDays(completed.starts) : null;

  let preferredTimeOfDay: TimeOfDayBucket | null = null;
  if (facet.hourCounts.length > 0) {
    const bucketTotals = new Map<TimeOfDayBucket, number>(TIME_OF_DAY_BUCKETS.map((b) => [b, 0]));
    for (const { _id: hour, count } of facet.hourCounts) {
      const bucket = hourToBucket(hour);
      bucketTotals.set(bucket, (bucketTotals.get(bucket) ?? 0) + count);
    }
    let best: TimeOfDayBucket | null = null;
    let bestCount = 0;
    for (const bucket of TIME_OF_DAY_BUCKETS) {
      const count = bucketTotals.get(bucket) ?? 0;
      if (count > bestCount) {
        best = bucket;
        bestCount = count;
      }
    }
    preferredTimeOfDay = best;
  }

  return {
    totalAppointments,
    completedVisits,
    cancellations,
    noShows,
    isNewCustomer: completedVisits === 0,
    lastAppointment: toSummary(facet.lastAppointment[0]),
    nextAppointment: toSummary(facet.nextAppointment[0]),
    visitFrequencyDays,
    mostBookedServices: facet.mostBookedServices.map((s) => ({
      serviceId: s.serviceId.toString(),
      serviceName: s.serviceName,
      count: s.count,
    })),
    totalRevenue,
    averageSpend,
    preferredTimeOfDay,
    recentCancellations,
  };
}

// ─── Rule-based insights (no ML) — plain threshold checks over the stats above ──────────────

export interface CustomerInsight {
  code:
    | 'RETURNS_PERIODICALLY'
    | 'DUE_FOR_REBOOKING'
    | 'FREQUENT_CANCELLATIONS'
    | 'NEW_CUSTOMER'
    | 'HAS_UPCOMING_NO_SHOW_RISK';
  severity: 'info' | 'warning';
  /** Structured params for the frontend to render its own copy — no message strings here. */
  data: Record<string, number | string>;
}

/** How far past the average interval counts as "overdue" (see task spec: 1.3x). */
const REBOOKING_OVERDUE_FACTOR = 1.3;
/** Recent-cancellation count that trips the "cancels a lot lately" flag. */
const FREQUENT_CANCELLATION_THRESHOLD = 2;

export function computeCustomerInsights(stats: CustomerStats, now: Date = new Date()): CustomerInsight[] {
  const insights: CustomerInsight[] = [];

  if (stats.isNewCustomer && stats.totalAppointments <= 1) {
    insights.push({ code: 'NEW_CUSTOMER', severity: 'info', data: {} });
  }

  if (stats.visitFrequencyDays != null) {
    const weeks = Math.round(stats.visitFrequencyDays / 7);
    insights.push({
      code: 'RETURNS_PERIODICALLY',
      severity: 'info',
      data: { days: stats.visitFrequencyDays, weeks },
    });

    if (stats.lastAppointment) {
      const daysSinceLast =
        (now.getTime() - new Date(stats.lastAppointment.start).getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceLast > stats.visitFrequencyDays * REBOOKING_OVERDUE_FACTOR) {
        insights.push({
          code: 'DUE_FOR_REBOOKING',
          severity: 'warning',
          data: {
            daysSinceLast: Math.round(daysSinceLast),
            avgIntervalDays: stats.visitFrequencyDays,
          },
        });
      }
    }
  }

  if (stats.recentCancellations >= FREQUENT_CANCELLATION_THRESHOLD) {
    insights.push({
      code: 'FREQUENT_CANCELLATIONS',
      severity: 'warning',
      data: { count: stats.recentCancellations, windowDays: RECENT_CANCELLATION_WINDOW_DAYS },
    });
  }

  return insights;
}
