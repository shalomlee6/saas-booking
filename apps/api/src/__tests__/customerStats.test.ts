import request from 'supertest';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedService, seedBusinessSettings } from './helpers/seed';
import { Customer } from '../models/Customer';
import { Appointment } from '../models/Appointment';

const app = buildTestApp();

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY_MS);
}

describe('CUSTOMER STATS — revenue, visit frequency, most-booked services', () => {
  it('computes completed-visit revenue, average spend, frequency, and the top service', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const serviceA = await seedService(business._id);
    const serviceB = await seedService(business._id);
    const customer = await Customer.create({ businessId: business._id, name: 'C1', phone: '111' });

    // Two completed visits of service A, 14 days apart, plus one of service B.
    await Appointment.create({
      businessId: business._id,
      customerId: customer._id,
      serviceId: serviceA._id,
      start: daysAgo(28),
      end: new Date(daysAgo(28).getTime() + 60 * 60 * 1000),
      status: 'completed',
      source: 'owner',
      price: 100,
    });
    await Appointment.create({
      businessId: business._id,
      customerId: customer._id,
      serviceId: serviceA._id,
      start: daysAgo(14),
      end: new Date(daysAgo(14).getTime() + 60 * 60 * 1000),
      status: 'completed',
      source: 'owner',
      price: 150,
    });
    await Appointment.create({
      businessId: business._id,
      customerId: customer._id,
      serviceId: serviceB._id,
      start: daysAgo(7),
      end: new Date(daysAgo(7).getTime() + 60 * 60 * 1000),
      status: 'completed',
      source: 'owner',
      price: 50,
    });

    const res = await request(app)
      .get(`/api/customers/${customer._id.toString()}/stats`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { stats, insights } = res.body;

    expect(stats.completedVisits).toBe(3);
    expect(stats.totalAppointments).toBe(3);
    expect(stats.isNewCustomer).toBe(false);
    expect(stats.totalRevenue).toBe(300);
    expect(stats.averageSpend).toBeCloseTo(100, 5);
    expect(stats.mostBookedServices[0].serviceId).toBe(serviceA._id.toString());
    expect(stats.mostBookedServices[0].count).toBe(2);

    // Gaps: 28→14 days ago (14-day gap), 14→7 days ago (7-day gap) → average 10.5 days.
    expect(stats.visitFrequencyDays).toBeCloseTo(10.5, 1);

    expect(Array.isArray(insights)).toBe(true);
  });

  it('flags NEW_CUSTOMER for someone with zero completed visits', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const customer = await Customer.create({ businessId: business._id, name: 'New Customer', phone: '222' });

    const res = await request(app)
      .get(`/api/customers/${customer._id.toString()}/stats`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.stats.isNewCustomer).toBe(true);
    expect(res.body.stats.totalAppointments).toBe(0);
    expect(res.body.insights.some((i: { code: string }) => i.code === 'NEW_CUSTOMER')).toBe(true);
  });
});

describe('CUSTOMER STATS — rule-based insights', () => {
  it('flags DUE_FOR_REBOOKING when the gap since the last visit exceeds 1.3x the average interval', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    const customer = await Customer.create({ businessId: business._id, name: 'Overdue', phone: '333' });

    // Average interval: 20 days. Last visit: 40 days ago (well past 20 * 1.3 = 26 days).
    await Appointment.create({
      businessId: business._id,
      customerId: customer._id,
      serviceId: service._id,
      start: daysAgo(60),
      end: new Date(daysAgo(60).getTime() + 60 * 60 * 1000),
      status: 'completed',
      source: 'owner',
      price: 100,
    });
    await Appointment.create({
      businessId: business._id,
      customerId: customer._id,
      serviceId: service._id,
      start: daysAgo(40),
      end: new Date(daysAgo(40).getTime() + 60 * 60 * 1000),
      status: 'completed',
      source: 'owner',
      price: 100,
    });

    const res = await request(app)
      .get(`/api/customers/${customer._id.toString()}/stats`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.stats.visitFrequencyDays).toBeCloseTo(20, 0);

    const insights: { code: string; data: Record<string, number> }[] = res.body.insights;
    const dueForRebooking = insights.find((i) => i.code === 'DUE_FOR_REBOOKING');
    expect(dueForRebooking).toBeDefined();
    expect(dueForRebooking!.data.avgIntervalDays).toBeCloseTo(20, 0);
    expect(dueForRebooking!.data.daysSinceLast).toBeGreaterThan(26);
  });

  it('flags FREQUENT_CANCELLATIONS after 2+ cancellations within the recent window', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    const customer = await Customer.create({ businessId: business._id, name: 'Canceller', phone: '444' });

    for (let i = 0; i < 2; i++) {
      await Appointment.create({
        businessId: business._id,
        customerId: customer._id,
        serviceId: service._id,
        start: daysFromNow(5 + i),
        end: new Date(daysFromNow(5 + i).getTime() + 60 * 60 * 1000),
        status: 'cancelled',
        source: 'owner',
      });
    }

    const res = await request(app)
      .get(`/api/customers/${customer._id.toString()}/stats`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.stats.recentCancellations).toBe(2);
    expect(
      res.body.insights.some((i: { code: string }) => i.code === 'FREQUENT_CANCELLATIONS')
    ).toBe(true);
  });

  it('counts a past appointment left pending/confirmed as a no-show (heuristic)', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    const customer = await Customer.create({ businessId: business._id, name: 'Ghost', phone: '555' });

    const start = daysAgo(2);
    await Appointment.create({
      businessId: business._id,
      customerId: customer._id,
      serviceId: service._id,
      start,
      end: new Date(start.getTime() + 30 * 60 * 1000),
      status: 'pending',
      source: 'owner',
    });

    const res = await request(app)
      .get(`/api/customers/${customer._id.toString()}/stats`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.stats.noShows).toBe(1);
  });

  it('reports the soonest upcoming appointment as nextAppointment', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    const customer = await Customer.create({ businessId: business._id, name: 'Booked', phone: '666' });

    const soon = daysFromNow(3);
    const later = daysFromNow(10);
    await Appointment.create({
      businessId: business._id,
      customerId: customer._id,
      serviceId: service._id,
      start: later,
      end: new Date(later.getTime() + 60 * 60 * 1000),
      status: 'confirmed',
      source: 'owner',
    });
    await Appointment.create({
      businessId: business._id,
      customerId: customer._id,
      serviceId: service._id,
      start: soon,
      end: new Date(soon.getTime() + 60 * 60 * 1000),
      status: 'pending',
      source: 'owner',
    });

    const res = await request(app)
      .get(`/api/customers/${customer._id.toString()}/stats`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.stats.nextAppointment).not.toBeNull();
    expect(new Date(res.body.stats.nextAppointment.start).getTime()).toBe(soon.getTime());
  });
});

describe('CUSTOMER APPOINTMENT HISTORY', () => {
  it('returns full past+upcoming history, most recent first, scoped to the tenant', async () => {
    const ownerA = await seedOwner({ email: 'a@test.com' });
    const ownerB = await seedOwner({ email: 'b@test.com' });
    const serviceA = await seedService(ownerA.business._id);
    const customerA = await Customer.create({ businessId: ownerA.business._id, name: 'A', phone: '1' });
    // Different tenant, same-shaped data — must never leak into A's history.
    const serviceB = await seedService(ownerB.business._id);
    const customerB = await Customer.create({ businessId: ownerB.business._id, name: 'B', phone: '2' });
    await Appointment.create({
      businessId: ownerB.business._id,
      customerId: customerB._id,
      serviceId: serviceB._id,
      start: daysAgo(1),
      end: new Date(daysAgo(1).getTime() + 60 * 60 * 1000),
      status: 'completed',
      source: 'owner',
    });

    const past = daysAgo(30);
    const upcoming = daysFromNow(5);
    await Appointment.create({
      businessId: ownerA.business._id,
      customerId: customerA._id,
      serviceId: serviceA._id,
      start: past,
      end: new Date(past.getTime() + 60 * 60 * 1000),
      status: 'completed',
      source: 'owner',
    });
    await Appointment.create({
      businessId: ownerA.business._id,
      customerId: customerA._id,
      serviceId: serviceA._id,
      start: upcoming,
      end: new Date(upcoming.getTime() + 60 * 60 * 1000),
      status: 'confirmed',
      source: 'owner',
    });

    const res = await request(app)
      .get(`/api/customers/${customerA._id.toString()}/appointments`)
      .set('Authorization', `Bearer ${ownerA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    // Sorted most-recent-first: the upcoming one (further in the future) comes before the past one.
    expect(new Date(res.body[0].start).getTime()).toBe(upcoming.getTime());
    expect(new Date(res.body[1].start).getTime()).toBe(past.getTime());
  });
});
