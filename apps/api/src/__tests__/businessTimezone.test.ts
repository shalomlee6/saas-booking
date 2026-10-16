import request from 'supertest';
import { DateTime } from 'luxon';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedService, seedBusinessSettings } from './helpers/seed';
import { Appointment } from '../models/Appointment';
import { BusinessSettings } from '../models/BusinessSettings';
import { Customer } from '../models/Customer';
import { defaultAppointmentWindow, insightsPeriodStart } from '../listQuery/dateRange';

const app = buildTestApp();
const ZONE = 'Asia/Jerusalem';

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => {
  process.env.TZ = 'UTC';
  await dbClear();
});
afterEach(() => {
  delete process.env.TZ;
});

/** Mongo $dayOfWeek: 1 = Sunday … 7 = Saturday. Luxon weekday: 1 = Monday … 7 = Sunday. */
function mongoWeekday(value: DateTime): number {
  return value.weekday === 7 ? 1 : value.weekday + 1;
}

describe('BUSINESS TIMEZONE — Jerusalem midnight on a UTC server', () => {
  it('keeps a visit just after Jerusalem midnight inside today and on the Jerusalem weekday', async () => {
    const fixedNow = new Date('2026-06-15T00:30:00.000Z');
    const midnight = DateTime.fromISO('2026-06-15T00:00:00', { zone: ZONE });
    const justAfter = midnight.plus({ minutes: 10 }).toJSDate();
    const window = defaultAppointmentWindow(fixedNow, ZONE, 30);
    expect(justAfter.getTime() >= window.start.getTime()).toBe(true);
    expect(justAfter.getTime() < new Date('2026-06-15T00:00:00.000Z').getTime()).toBe(true);
    expect(insightsPeriodStart('month', ZONE, fixedNow).toISOString()).toBe(
      DateTime.fromISO('2026-06-01T00:00:00', { zone: ZONE }).toJSDate().toISOString()
    );

    const { business, token } = await seedOwner();
    const service = await seedService(business._id);
    await seedBusinessSettings(business._id);
    await BusinessSettings.updateOne(
      { businessId: business._id },
      { $set: { 'localization.timezone': ZONE, 'features.analyticsEnabled': true } }
    );
    const afterCustomer = await Customer.create({
      businessId: business._id,
      name: 'After Midnight',
      phone: '0501111111',
    });
    const beforeCustomer = await Customer.create({
      businessId: business._id,
      name: 'Before Midnight',
      phone: '0502222222',
    });

    const now = new Date();
    const todayStart = DateTime.fromJSDate(now, { zone: ZONE }).startOf('day');
    const afterMidnight = todayStart.plus({ minutes: 10 });
    const beforeMidnight = todayStart.plus({ minutes: -10 });
    await Appointment.create({
      businessId: business._id,
      customerId: afterCustomer._id,
      serviceId: service._id,
      start: afterMidnight.toJSDate(),
      end: afterMidnight.plus({ minutes: 30 }).toJSDate(),
      status: 'completed',
      source: 'owner',
      price: 80,
    });
    await Appointment.create({
      businessId: business._id,
      customerId: beforeCustomer._id,
      serviceId: service._id,
      start: beforeMidnight.toJSDate(),
      end: beforeMidnight.plus({ minutes: 30 }).toJSDate(),
      status: 'confirmed',
      source: 'owner',
    });

    const listed = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${token}`);
    expect(listed.status).toBe(200);
    const names = (listed.body as { customerName: string }[]).map((row) => row.customerName);
    expect(names.includes('After Midnight')).toBe(true);
    expect(names.includes('Before Midnight')).toBe(false);

    const insights = await request(app)
      .get('/api/business/insights?period=month')
      .set('Authorization', `Bearer ${token}`);
    expect(insights.status).toBe(200);
    expect(insights.body.totalRevenue).toBe(80);
    const jerusalemDay = mongoWeekday(afterMidnight);
    const utcDay = mongoWeekday(DateTime.fromJSDate(afterMidnight.toJSDate(), { zone: 'UTC' }));
    expect(jerusalemDay).not.toBe(utcDay);
    const buckets = insights.body.revenueByWeekday as { weekday: number; total: number }[];
    expect(buckets.length).toBe(1);
    expect(buckets[0].weekday).toBe(jerusalemDay);
    expect(buckets[0].total).toBe(80);
  });
});
