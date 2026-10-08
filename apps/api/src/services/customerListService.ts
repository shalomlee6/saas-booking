import { DateTime } from 'luxon';
import { Types } from 'mongoose';
import { Customer } from '../models/Customer';
import { ForbiddenError } from '../errors/httpErrors';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import {
  bookingBlockedExpression,
  noShowCountAggregationExpression,
  resolveNoShowPolicy,
  type BookingOverride,
  type NoShowPolicy,
} from './customerNoShows';
import {
  andFilters,
  buildCsv,
  buildSearchClause,
  hebrewNameCollation,
  queryListPage,
  type ListAggregateSource,
  startOfBusinessDay,
  type ListPage,
} from '../listQuery';
import {
  CUSTOMER_METRIC_SORT_FIELDS,
  type customersPagedQuerySchema,
} from '../validation/schemas/customers';
import type { z } from 'zod';

export type CustomersPagedQuery = z.infer<typeof customersPagedQuerySchema>;

const METRIC_FILTERS = [
  'customerType',
  'activity',
  'visitsMin',
  'visitsMax',
  'revenueMin',
  'revenueMax',
  'preferredTime',
  'preferredService',
] as const;

export interface CustomerListRow {
  _id: Types.ObjectId;
  name: string;
  fullName: string;
  phone: string;
  email: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  totalVisits: number;
  totalRevenue: number;
  averageVisitValue: number;
  lastVisit: Date | null;
  nextAppointment: Date | null;
  noShowCount: number;
  blocked: boolean;
  bookingOverride: BookingOverride;
  customerType: 'new' | 'returning';
  preferredServiceId: Types.ObjectId | null;
  preferredServiceName: string;
  preferredTimeOfDay: string | null;
}

function hourBucket(hour: Record<string, unknown>): Record<string, unknown> {
  return {
    $switch: {
      branches: [
        { case: { $and: [{ $gte: [hour, 5] }, { $lt: [hour, 12] }] }, then: 'morning' },
        { case: { $and: [{ $gte: [hour, 12] }, { $lt: [hour, 17] }] }, then: 'afternoon' },
        { case: { $and: [{ $gte: [hour, 17] }, { $lt: [hour, 22] }] }, then: 'evening' },
      ],
      default: 'night',
    },
  };
}

function metricStages(now: Date, timezone: string, policy: NoShowPolicy): Record<string, unknown>[] {
  const completed = {
    $filter: {
      input: '$appointments',
      as: 'a',
      cond: { $eq: ['$$a.status', 'completed'] },
    },
  };
  return [
    {
      $lookup: {
        from: 'appointments',
        let: { customerId: '$_id', businessId: '$businessId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$customerId', '$$customerId'] },
                  { $eq: ['$businessId', '$$businessId'] },
                ],
              },
            },
          },
          { $project: { status: 1, start: 1, price: 1, serviceId: 1, noShowExcused: 1 } },
        ],
        as: 'appointments',
      },
    },
    {
      $addFields: {
        completedAppointments: completed,
      },
    },
    {
      $addFields: {
        totalVisits: { $size: '$completedAppointments' },
        totalRevenue: {
          $sum: {
            $map: {
              input: '$completedAppointments',
              as: 'a',
              in: { $ifNull: ['$$a.price', 0] },
            },
          },
        },
        lastVisit: { $max: '$completedAppointments.start' },
        nextAppointment: {
          $min: {
            $map: {
              input: {
                $filter: {
                  input: '$appointments',
                  as: 'a',
                  cond: {
                    $and: [
                      { $in: ['$$a.status', ['pending', 'confirmed']] },
                      { $gt: ['$$a.start', now] },
                    ],
                  },
                },
              },
              as: 'a',
              in: '$$a.start',
            },
          },
        },
        noShowCount: noShowCountAggregationExpression(),
        preferredServiceId: {
          $let: {
            vars: {
              ranked: {
                $sortArray: {
                  input: {
                    $map: {
                      input: { $setUnion: ['$completedAppointments.serviceId', []] },
                      as: 'serviceId',
                      in: {
                        serviceId: '$$serviceId',
                        count: {
                          $size: {
                            $filter: {
                              input: '$completedAppointments',
                              as: 'a',
                              cond: { $eq: ['$$a.serviceId', '$$serviceId'] },
                            },
                          },
                        },
                      },
                    },
                  },
                  sortBy: { count: -1 },
                },
              },
            },
            in: { $ifNull: [{ $first: '$$ranked.serviceId' }, null] },
          },
        },
        preferredTimeOfDay: {
          $let: {
            vars: {
              buckets: {
                $map: {
                  input: '$completedAppointments',
                  as: 'a',
                  in: hourBucket({ $hour: { date: '$$a.start', timezone } }),
                },
              },
            },
            in: {
              $let: {
                vars: {
                  ranked: {
                    $sortArray: {
                      input: {
                        $map: {
                          input: { $setUnion: ['$$buckets', []] },
                          as: 'bucket',
                          in: {
                            bucket: '$$bucket',
                            count: {
                              $size: {
                                $filter: {
                                  input: '$$buckets',
                                  as: 'b',
                                  cond: { $eq: ['$$b', '$$bucket'] },
                                },
                              },
                            },
                          },
                        },
                      },
                      sortBy: { count: -1 },
                    },
                  },
                },
                in: { $ifNull: [{ $first: '$$ranked.bucket' }, null] },
              },
            },
          },
        },
      },
    },
    {
      $addFields: {
        averageVisitValue: {
          $cond: [{ $gt: ['$totalVisits', 0] }, { $divide: ['$totalRevenue', '$totalVisits'] }, 0],
        },
        bookingOverride: { $ifNull: ['$bookingOverride', 'auto'] },
        blocked: bookingBlockedExpression(policy),
        customerType: {
          $cond: [{ $lt: ['$totalVisits', 2] }, 'new', 'returning'],
        },
        fullName: '$name',
        isActive: { $ne: ['$isActive', false] },
        email: { $ifNull: ['$email', ''] },
        phone: { $ifNull: ['$phone', ''] },
      },
    },
    {
      $lookup: {
        from: 'services',
        localField: 'preferredServiceId',
        foreignField: '_id',
        as: 'preferredServiceDoc',
      },
    },
    {
      $addFields: {
        preferredServiceName: {
          $ifNull: [{ $arrayElemAt: ['$preferredServiceDoc.name', 0] }, ''],
        },
      },
    },
  ];
}

function customerMatch(
  businessId: string,
  query: CustomersPagedQuery,
  timezone: string
): Record<string, unknown> {
  const status = query.status ?? 'active';
  const statusClause =
    status === 'all' ? {} : status === 'inactive' ? { isActive: false } : { isActive: { $ne: false } };
  const created: Record<string, Date> = {};
  if (query.createdFrom) created.$gte = startOfBusinessDay(query.createdFrom, timezone);
  if (query.createdTo) created.$lt = startOfBusinessDay(query.createdTo, timezone);
  const createdClause = Object.keys(created).length > 0 ? { createdAt: created } : {};
  const search = buildSearchClause(query.search, { text: ['name', 'email'], phone: ['phone'] });
  return andFilters({ businessId: new Types.ObjectId(businessId) }, statusClause, createdClause, search);
}

/** `now` minus N calendar days in the business timezone. */
function daysBefore(now: Date, days: number, timezone: string): Date {
  const zone = timezone.trim() || 'Asia/Jerusalem';
  const zoned = DateTime.fromJSDate(now, { zone });
  const value = zoned.isValid ? zoned : DateTime.fromJSDate(now, { zone: 'Asia/Jerusalem' });
  return value.minus({ days }).toJSDate();
}

function activityClause(
  activity: NonNullable<CustomersPagedQuery['activity']>,
  timezone: string,
  now: Date
): Record<string, unknown> {
  if (activity === 'noVisits') return { totalVisits: 0 };
  if (activity === 'noUpcoming') return { nextAppointment: null };
  const days = activity === 'lastVisitOver30' ? 30 : activity === 'lastVisitOver60' ? 60 : 90;
  return {
    totalVisits: { $gte: 1 },
    lastVisit: { $lt: daysBefore(now, days, timezone) },
  };
}

function afterMetricsMatch(query: CustomersPagedQuery, timezone: string, now: Date): Record<string, unknown> {
  const clauses: Record<string, unknown>[] = [];
  if (query.blocked === 'true') clauses.push({ blocked: true });
  if (query.blocked === 'false') clauses.push({ blocked: false });
  if (query.customerType) clauses.push({ customerType: query.customerType });
  if (query.preferredTime) clauses.push({ preferredTimeOfDay: query.preferredTime });
  if (query.preferredService) clauses.push({ preferredServiceId: new Types.ObjectId(query.preferredService) });
  if (query.visitsMin !== undefined || query.visitsMax !== undefined) {
    const range: Record<string, number> = {};
    if (query.visitsMin !== undefined) range.$gte = query.visitsMin;
    if (query.visitsMax !== undefined) range.$lt = query.visitsMax;
    clauses.push({ totalVisits: range });
  }
  if (query.revenueMin !== undefined || query.revenueMax !== undefined) {
    const range: Record<string, number> = {};
    if (query.revenueMin !== undefined) range.$gte = query.revenueMin;
    if (query.revenueMax !== undefined) range.$lt = query.revenueMax;
    clauses.push({ totalRevenue: range });
  }
  if (query.activity) clauses.push(activityClause(query.activity, timezone, now));
  return andFilters(...clauses);
}

function assertMetricAccess(query: CustomersPagedQuery, owner: boolean): void {
  if (owner) return;
  const metricSort = (CUSTOMER_METRIC_SORT_FIELDS as readonly string[]).includes(query.sort);
  const metricFilter = METRIC_FILTERS.some((key) => query[key] !== undefined);
  if (metricSort || metricFilter) {
    throw new ForbiddenError('Owner access required');
  }
}

function projectRow(): Record<string, unknown> {
  return {
    $project: {
      name: 1,
      fullName: 1,
      phone: 1,
      email: 1,
      notes: 1,
      isActive: 1,
      createdAt: 1,
      updatedAt: 1,
      totalVisits: 1,
      totalRevenue: 1,
      averageVisitValue: 1,
      lastVisit: 1,
      nextAppointment: 1,
      noShowCount: 1,
      blocked: 1,
      bookingOverride: 1,
      customerType: 1,
      preferredServiceId: 1,
      preferredServiceName: 1,
      preferredTimeOfDay: 1,
    },
  };
}

async function prepare(businessId: string, query: CustomersPagedQuery, owner: boolean) {
  assertMetricAccess(query, owner);
  const settings = await ensureBusinessSettings(businessId);
  const timezone = settings.localization?.timezone ?? 'Asia/Jerusalem';
  const now = new Date();
  const metricFilter = afterMetricsMatch(query, timezone, now);
  const beforeFacet = [
    ...metricStages(now, timezone, resolveNoShowPolicy(settings)),
    ...(Object.keys(metricFilter).length > 0 ? [{ $match: metricFilter }] : []),
    projectRow(),
  ];
  return { timezone, beforeFacet, match: customerMatch(businessId, query, timezone) };
}

export async function listCustomersPage(
  businessId: string,
  query: CustomersPagedQuery,
  owner: boolean
): Promise<ListPage<CustomerListRow>> {
  const { beforeFacet, match } = await prepare(businessId, query, owner);
  const page = await queryListPage<CustomerListRow>(
    Customer as unknown as ListAggregateSource,
    match,
    { page: query.page, limit: query.limit, sortField: query.sort, order: query.order },
    {
      beforeFacet,
      collation: query.sort === 'name' ? hebrewNameCollation() : undefined,
    }
  );
  if (!owner) {
    return {
      ...page,
      items: page.items.map((item) => stripMetrics(item)),
    };
  }
  return page;
}

const METRIC_KEYS = [
  'totalVisits',
  'totalRevenue',
  'averageVisitValue',
  'lastVisit',
  'nextAppointment',
  'noShowCount',
  'customerType',
  'preferredServiceId',
  'preferredServiceName',
  'preferredTimeOfDay',
] as const;

function stripMetrics(item: CustomerListRow): CustomerListRow {
  const copy: Partial<CustomerListRow> = { ...item };
  for (const key of METRIC_KEYS) {
    delete copy[key];
  }
  return copy as CustomerListRow;
}

export async function listCustomersForExport(
  businessId: string,
  query: CustomersPagedQuery
): Promise<CustomerListRow[]> {
  const { beforeFacet, match } = await prepare(businessId, query, true);
  const direction = query.order === 'asc' ? 1 : -1;
  const cursor = Customer.aggregate<CustomerListRow>([
    { $match: match },
    ...beforeFacet,
    { $sort: { [query.sort]: direction } },
    { $limit: 10_001 },
  ] as never[]);
  const rows = query.sort === 'name' ? await cursor.collation(hebrewNameCollation()) : await cursor;
  return rows;
}

export function customersToCsv(rows: CustomerListRow[]) {
  return buildCsv(
    [
      { key: 'name', header: 'Name' },
      { key: 'phone', header: 'Phone', phone: true },
      { key: 'email', header: 'Email' },
      { key: 'isActive', header: 'Active' },
      { key: 'totalVisits', header: 'Total visits' },
      { key: 'totalRevenue', header: 'Total revenue' },
      { key: 'averageVisitValue', header: 'Average visit value' },
      { key: 'lastVisit', header: 'Last visit' },
      { key: 'nextAppointment', header: 'Next appointment' },
      { key: 'noShowCount', header: 'No-shows' },
      { key: 'blocked', header: 'Blocked' },
      { key: 'customerType', header: 'Customer type' },
      { key: 'preferredServiceName', header: 'Preferred service' },
      { key: 'preferredTimeOfDay', header: 'Preferred time' },
      { key: 'createdAt', header: 'Customer since' },
    ],
    rows.map((row) => ({
      ...row,
      isActive: row.isActive ? 'active' : 'inactive',
      lastVisit: row.lastVisit ? new Date(row.lastVisit).toISOString() : '',
      nextAppointment: row.nextAppointment ? new Date(row.nextAppointment).toISOString() : '',
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : '',
    }))
  );
}
