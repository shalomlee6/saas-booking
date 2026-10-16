import { DateTime } from 'luxon';
import { Types } from 'mongoose';
import { Service } from '../models/Service';
import { ForbiddenError } from '../errors/httpErrors';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import {
  andFilters,
  buildCsv,
  buildSearchClause,
  hebrewNameCollation,
  queryListPage,
  type ListAggregateSource,
  type ListPage,
} from '../listQuery';
import {
  SERVICE_METRIC_SORT_FIELDS,
  type servicesPagedQuerySchema,
} from '../validation/schemas/services';
import type { z } from 'zod';

export type ServicesPagedQuery = z.infer<typeof servicesPagedQuerySchema>;

const METRIC_FILTERS = ['activity', 'bookingsMin', 'bookingsMax', 'revenueMin', 'revenueMax'] as const;

export interface ServiceListRow {
  _id: Types.ObjectId;
  name: string;
  description: string;
  duration: number;
  durationMinutes: number;
  price: number;
  isActive: boolean;
  createdAt: Date;
  bookings: number;
  completedBookings: number;
  revenue: number;
  averageActualPrice: number;
  revenuePerHour: number;
  lastBooking: Date | null;
  upcomingAppointments: number;
}

function daysBefore(now: Date, days: number, timezone: string): Date {
  const zone = timezone.trim() || 'Asia/Jerusalem';
  const zoned = DateTime.fromJSDate(now, { zone });
  const value = zoned.isValid ? zoned : DateTime.fromJSDate(now, { zone: 'Asia/Jerusalem' });
  return value.minus({ days }).toJSDate();
}

function rangeClause(field: string, min?: number, max?: number): Record<string, unknown> | null {
  if (min === undefined && max === undefined) return null;
  const range: Record<string, number> = {};
  if (min !== undefined) range.$gte = min;
  if (max !== undefined) range.$lt = max;
  return { [field]: range };
}

/** Hours of one completed appointment. Prefer the stored duration, then the clock span. */
function completedHoursExpression(): Record<string, unknown> {
  return {
    $sum: {
      $map: {
        input: '$completedAppointments',
        as: 'a',
        in: {
          $let: {
            vars: {
              clockMinutes: {
                $divide: [{ $max: [0, { $subtract: ['$$a.end', '$$a.start'] }] }, 60000],
              },
            },
            in: {
              $divide: [
                {
                  $cond: [{ $gt: ['$$a.durationMinutes', 0] }, '$$a.durationMinutes', '$$clockMinutes'],
                },
                60,
              ],
            },
          },
        },
      },
    },
  };
}

function metricStages(now: Date): Record<string, unknown>[] {
  const completed = {
    $filter: {
      input: '$appointments',
      as: 'a',
      cond: { $eq: ['$$a.status', 'completed'] },
    },
  };
  const upcoming = {
    $filter: {
      input: '$appointments',
      as: 'a',
      cond: {
        $and: [{ $in: ['$$a.status', ['pending', 'confirmed']] }, { $gt: ['$$a.start', now] }],
      },
    },
  };
  return [
    {
      $lookup: {
        from: 'appointments',
        let: { serviceId: '$_id', businessId: '$businessId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$serviceId', '$$serviceId'] },
                  { $eq: ['$businessId', '$$businessId'] },
                ],
              },
            },
          },
          { $project: { status: 1, price: 1, start: 1, end: 1, durationMinutes: 1, createdAt: 1 } },
        ],
        as: 'appointments',
      },
    },
    { $addFields: { completedAppointments: completed } },
    {
      $addFields: {
        bookings: { $size: '$appointments' },
        completedBookings: { $size: '$completedAppointments' },
        revenue: {
          $sum: {
            $map: {
              input: '$completedAppointments',
              as: 'a',
              in: { $ifNull: ['$$a.price', 0] },
            },
          },
        },
        completedHours: completedHoursExpression(),
        lastBooking: { $max: '$appointments.createdAt' },
        upcomingAppointments: { $size: upcoming },
        duration: '$durationMinutes',
      },
    },
    {
      $addFields: {
        averageActualPrice: {
          $cond: [{ $gt: ['$completedBookings', 0] }, { $divide: ['$revenue', '$completedBookings'] }, 0],
        },
        revenuePerHour: {
          $cond: [{ $gt: ['$completedHours', 0] }, { $divide: ['$revenue', '$completedHours'] }, 0],
        },
      },
    },
  ];
}

function activityClause(
  activity: NonNullable<ServicesPagedQuery['activity']>,
  timezone: string,
  now: Date
): Record<string, unknown> {
  if (activity === 'neverBooked') return { lastBooking: null };
  const days = activity === 'noBookingsIn30' ? 30 : activity === 'noBookingsIn60' ? 60 : 90;
  return {
    bookings: { $gte: 1 },
    lastBooking: { $lt: daysBefore(now, days, timezone) },
  };
}

function afterMetricsMatch(query: ServicesPagedQuery, timezone: string, now: Date): Record<string, unknown> {
  const status = query.status ?? 'active';
  const statusClause =
    status === 'all' ? null : status === 'inactive' ? { isActive: false } : { isActive: { $ne: false } };
  const search = buildSearchClause(query.search, { text: ['name', 'description'] });
  return andFilters(
    statusClause,
    search,
    rangeClause('price', query.priceMin, query.priceMax),
    rangeClause('duration', query.durationMin, query.durationMax),
    rangeClause('bookings', query.bookingsMin, query.bookingsMax),
    rangeClause('revenue', query.revenueMin, query.revenueMax),
    query.activity ? activityClause(query.activity, timezone, now) : null
  );
}

function assertMetricAccess(query: ServicesPagedQuery, owner: boolean): void {
  if (owner) return;
  const metricSort = (SERVICE_METRIC_SORT_FIELDS as readonly string[]).includes(query.sort);
  const metricFilter = METRIC_FILTERS.some((key) => query[key] !== undefined);
  if (metricSort || metricFilter) {
    throw new ForbiddenError('Owner access required');
  }
}

function projectRow(): Record<string, unknown> {
  return {
    $project: {
      name: 1,
      description: { $ifNull: ['$description', ''] },
      duration: 1,
      durationMinutes: 1,
      price: 1,
      isActive: 1,
      createdAt: 1,
      bookings: 1,
      completedBookings: 1,
      revenue: 1,
      averageActualPrice: 1,
      revenuePerHour: 1,
      lastBooking: 1,
      upcomingAppointments: 1,
    },
  };
}

async function prepare(businessId: string, query: ServicesPagedQuery, owner: boolean) {
  assertMetricAccess(query, owner);
  const settings = await ensureBusinessSettings(businessId);
  const timezone = settings.localization?.timezone ?? 'Asia/Jerusalem';
  const now = new Date();
  const metricFilter = afterMetricsMatch(query, timezone, now);
  const beforeFacet = [
    ...metricStages(now),
    ...(Object.keys(metricFilter).length > 0 ? [{ $match: metricFilter }] : []),
    projectRow(),
  ];
  return { beforeFacet, match: { businessId: new Types.ObjectId(businessId) } };
}

const METRIC_KEYS = [
  'bookings',
  'completedBookings',
  'revenue',
  'averageActualPrice',
  'revenuePerHour',
  'lastBooking',
] as const;

function stripMetrics(item: ServiceListRow): ServiceListRow {
  const copy: Partial<ServiceListRow> = { ...item };
  for (const key of METRIC_KEYS) {
    delete copy[key];
  }
  return copy as ServiceListRow;
}

export async function listServicesPage(
  businessId: string,
  query: ServicesPagedQuery,
  owner: boolean
): Promise<ListPage<ServiceListRow>> {
  const { beforeFacet, match } = await prepare(businessId, query, owner);
  const page = await queryListPage<ServiceListRow>(
    Service as unknown as ListAggregateSource,
    match,
    { page: query.page, limit: query.limit, sortField: query.sort, order: query.order },
    {
      beforeFacet,
      collation: query.sort === 'name' ? hebrewNameCollation() : undefined,
    }
  );
  if (!owner) {
    return { ...page, items: page.items.map((item) => stripMetrics(item)) };
  }
  return page;
}

export async function listServicesForExport(
  businessId: string,
  query: ServicesPagedQuery
): Promise<ServiceListRow[]> {
  const { beforeFacet, match } = await prepare(businessId, query, true);
  const direction = query.order === 'asc' ? 1 : -1;
  const cursor = Service.aggregate<ServiceListRow>([
    { $match: match },
    ...beforeFacet,
    { $sort: { [query.sort]: direction } },
    { $limit: 10_001 },
  ] as never[]);
  return query.sort === 'name' ? cursor.collation(hebrewNameCollation()) : cursor;
}

export function servicesToCsv(rows: ServiceListRow[]) {
  return buildCsv(
    [
      { key: 'name', header: 'Name' },
      { key: 'description', header: 'Description' },
      { key: 'duration', header: 'Duration' },
      { key: 'price', header: 'Price' },
      { key: 'isActive', header: 'Active' },
      { key: 'bookings', header: 'Bookings' },
      { key: 'completedBookings', header: 'Completed bookings' },
      { key: 'revenue', header: 'Revenue' },
      { key: 'averageActualPrice', header: 'Average actual price' },
      { key: 'revenuePerHour', header: 'Revenue per hour' },
      { key: 'lastBooking', header: 'Last booking' },
      { key: 'createdAt', header: 'Created' },
    ],
    rows.map((row) => ({
      ...row,
      isActive: row.isActive ? 'active' : 'inactive',
      lastBooking: row.lastBooking ? new Date(row.lastBooking).toISOString() : '',
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : '',
    }))
  );
}

export async function setServicesActiveForTenant(
  businessId: string,
  ids: string[],
  isActive: boolean
): Promise<{ ids: Types.ObjectId[]; updated: number }> {
  const existing = await Service.find({ businessId, _id: { $in: ids } }).select('_id');
  const found = existing.map((service) => service._id);
  if (found.length === 0) return { ids: [], updated: 0 };
  const result = await Service.updateMany({ businessId, _id: { $in: found } }, { $set: { isActive } });
  return { ids: found, updated: result.matchedCount };
}
