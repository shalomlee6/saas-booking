import { DateTime } from 'luxon';
import { Types } from 'mongoose';
import { Appointment } from '../models/Appointment';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import {
  andFilters,
  buildSearchClause,
  hebrewNameCollation,
  queryListPage,
  startOfBusinessDay,
  type ListAggregateSource,
  type ListPage,
} from '../listQuery';
import type { appointmentsPagedQuerySchema } from '../validation/schemas/appointments';
import type { z } from 'zod';

export type AppointmentsPagedQuery = z.infer<typeof appointmentsPagedQuerySchema>;

export interface AppointmentListRow {
  _id: Types.ObjectId;
  customerName: string;
  customerPhone: string;
  customerPreferredTimeOfDay: string | null;
  serviceId: Types.ObjectId | null;
  serviceName: string;
  start: Date;
  end: Date;
  duration: number;
  price: number;
  status: string;
  source: string;
  notes: string;
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

function metricStages(timezone: string): Record<string, unknown>[] {
  const hour = { $hour: { date: '$start', timezone } };
  return [
    {
      $lookup: {
        from: 'customers',
        localField: 'customerId',
        foreignField: '_id',
        as: 'customerDoc',
      },
    },
    {
      $lookup: {
        from: 'services',
        localField: 'serviceId',
        foreignField: '_id',
        as: 'serviceDoc',
      },
    },
    {
      $addFields: {
        customerName: {
          $ifNull: [
            { $arrayElemAt: ['$customerDoc.name', 0] },
            { $ifNull: ['$customerName', ''] },
          ],
        },
        customerPhone: {
          $ifNull: [
            { $arrayElemAt: ['$customerDoc.phone', 0] },
            { $ifNull: ['$customerPhone', ''] },
          ],
        },
        customerPreferredTimeOfDay: {
          $ifNull: [{ $arrayElemAt: ['$customerDoc.preferences.preferredTimeOfDay', 0] }, null],
        },
        serviceName: {
          $ifNull: [{ $arrayElemAt: ['$serviceDoc.name', 0] }, ''],
        },
        duration: {
          $cond: [
            { $gt: ['$durationMinutes', 0] },
            '$durationMinutes',
            {
              $divide: [{ $max: [0, { $subtract: ['$end', '$start'] }] }, 60000],
            },
          ],
        },
        price: { $ifNull: ['$price', 0] },
        timeOfDay: hourBucket(hour),
      },
    },
  ];
}

function dateClause(
  query: AppointmentsPagedQuery,
  timezone: string,
  now: Date
): Record<string, unknown> | null {
  if (query.startFrom || query.startTo) {
    const range: Record<string, Date> = {};
    if (query.startFrom) range.$gte = startOfBusinessDay(query.startFrom, timezone);
    if (query.startTo) range.$lt = startOfBusinessDay(query.startTo, timezone);
    return { start: range };
  }
  // "Ended, not marked" is in the past. The upcoming default would hide every row,
  // so it applies only when the client did not ask for that queue and did not send dates.
  if (query.queue === 'unmarked') return null;
  return { start: { $gte: now } };
}

function afterLookupMatch(query: AppointmentsPagedQuery, timezone: string, now: Date): Record<string, unknown> {
  const clauses: Array<Record<string, unknown> | null> = [dateClause(query, timezone, now)];
  if (query.queue === 'pending') clauses.push({ status: 'pending' });
  if (query.queue === 'unmarked') clauses.push({ status: 'confirmed', end: { $lt: now } });
  if (query.status) clauses.push({ status: query.status });
  if (query.service) clauses.push({ serviceId: new Types.ObjectId(query.service) });
  if (query.source) clauses.push({ source: query.source });
  if (query.priceMin !== undefined || query.priceMax !== undefined) {
    const range: Record<string, number> = {};
    if (query.priceMin !== undefined) range.$gte = query.priceMin;
    if (query.priceMax !== undefined) range.$lt = query.priceMax;
    clauses.push({ price: range });
  }
  if (query.timeOfDay) clauses.push({ timeOfDay: query.timeOfDay });
  clauses.push(buildSearchClause(query.search, {
    text: ['customerName', 'customerPhone', 'serviceName'],
    phone: ['customerPhone'],
  }));
  return andFilters(...clauses);
}

function projectRow(): Record<string, unknown> {
  return {
    $project: {
      customerName: 1,
      customerPhone: 1,
      customerPreferredTimeOfDay: 1,
      serviceId: 1,
      serviceName: 1,
      start: 1,
      end: 1,
      duration: 1,
      price: 1,
      status: 1,
      source: 1,
      notes: { $ifNull: ['$notes', ''] },
    },
  };
}

async function prepare(businessId: string, query: AppointmentsPagedQuery) {
  const settings = await ensureBusinessSettings(businessId);
  const timezone = settings.localization?.timezone ?? 'Asia/Jerusalem';
  const now = new Date();
  const filter = afterLookupMatch(query, timezone, now);
  const beforeFacet = [
    ...metricStages(timezone),
    ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
    projectRow(),
  ];
  return { beforeFacet, match: { businessId: new Types.ObjectId(businessId) } };
}

export async function listAppointmentsPage(
  businessId: string,
  query: AppointmentsPagedQuery
): Promise<ListPage<AppointmentListRow>> {
  const { beforeFacet, match } = await prepare(businessId, query);
  return queryListPage<AppointmentListRow>(
    Appointment as unknown as ListAggregateSource,
    match,
    { page: query.page, limit: query.limit, sortField: query.sort, order: query.order },
    {
      beforeFacet,
      collation: query.sort === 'customerName' ? hebrewNameCollation() : undefined,
    }
  );
}

/** Sunday-start week containing `now`, in the business timezone. */
export function businessWeekRange(now: Date, timezone: string): { start: Date; end: Date } {
  const zoned = DateTime.fromJSDate(now, { zone: timezone || 'Asia/Jerusalem' });
  const start = zoned.startOf('day').minus({ days: zoned.weekday % 7 });
  return { start: start.toJSDate(), end: start.plus({ days: 7 }).toJSDate() };
}
