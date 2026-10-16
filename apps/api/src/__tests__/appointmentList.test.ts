import request from 'supertest';
import { DateTime } from 'luxon';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedService, seedBusinessSettings, seedCustomer } from './helpers/seed';
import { Appointment } from '../models/Appointment';
import { Service } from '../models/Service';
import { APPOINTMENT_LIST_SORT_FIELDS } from '../validation/schemas/appointments';
import { businessWeekRange } from '../services/appointmentListService';

const app = buildTestApp();

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

const HOUR = 60 * 60 * 1000;

function utcKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function book(options: {
  businessId: unknown;
  serviceId: unknown;
  customerId?: unknown;
  start: Date;
  minutes?: number;
  status?: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  source?: 'owner' | 'client-online';
  price?: number;
  customerName?: string;
  customerPhone?: string;
}) {
  const minutes = options.minutes ?? 60;
  return Appointment.create({
    businessId: options.businessId,
    serviceId: options.serviceId,
    customerId: options.customerId,
    start: options.start,
    end: new Date(options.start.getTime() + minutes * 60 * 1000),
    status: options.status ?? 'confirmed',
    source: options.source ?? 'owner',
    price: options.price ?? 0,
    durationMinutes: minutes,
    customerName: options.customerName,
    customerPhone: options.customerPhone,
  });
}

async function namesFor(token: string, query: string): Promise<string[]> {
  const res = await request(app)
    .get(`/api/appointments?page=1&limit=100&${query}`)
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  return (res.body.items as { customerName: string }[]).map((row) => row.customerName).sort();
}

describe('GET /api/appointments list mode', () => {
  it('keeps the from/to array response when page is omitted', async () => {
    const { business, token } = await seedOwner();
    const service = await seedService(business._id);
    const past = new Date(Date.now() - 10 * 24 * HOUR);
    const future = new Date(Date.now() + 2 * HOUR);
    await book({ businessId: business._id, serviceId: service._id, start: past, customerName: 'Past' });
    await book({ businessId: business._id, serviceId: service._id, start: future, customerName: 'Soon' });

    const from = new Date(past.getTime() - HOUR).toISOString();
    const to = new Date(past.getTime() + 2 * HOUR).toISOString();
    const calendar = await request(app)
      .get(`/api/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .set('Authorization', `Bearer ${token}`);
    expect(calendar.status).toBe(200);
    expect(Array.isArray(calendar.body)).toBe(true);
    expect(calendar.body.length).toBe(1);
    expect(calendar.body[0].customerName).toBe('Past');

    const listed = await request(app)
      .get('/api/appointments?page=1')
      .set('Authorization', `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(Array.isArray(listed.body)).toBe(false);
    expect(listed.body.items.map((row: { customerName: string }) => row.customerName)).toEqual(['Soon']);
  });

  it('applies date windows, status, service, source, price, and time of day', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const cut = await seedService(business._id);
    const color = await Service.create({
      businessId: business._id,
      name: 'Color',
      durationMinutes: 90,
      price: 200,
      isActive: true,
    });
    const now = new Date();
    const todayStart = DateTime.fromJSDate(now, { zone: 'UTC' }).startOf('day');
    const tomorrowStart = todayStart.plus({ days: 1 });
    const week = businessWeekRange(now, 'UTC');
    const soon = new Date(now.getTime() + 30 * 60 * 1000);
    await book({
      businessId: business._id,
      serviceId: cut._id,
      start: soon,
      customerName: 'Soon',
      price: 80,
      status: 'confirmed',
    });
    await book({
      businessId: business._id,
      serviceId: cut._id,
      start: new Date(tomorrowStart.toMillis() + 10 * HOUR),
      customerName: 'Morning',
      price: 80,
      status: 'pending',
    });
    await book({
      businessId: business._id,
      serviceId: cut._id,
      start: new Date(tomorrowStart.toMillis() + 13 * HOUR),
      customerName: 'Afternoon',
      price: 150,
      source: 'client-online',
    });
    await book({
      businessId: business._id,
      serviceId: color._id,
      start: new Date(tomorrowStart.toMillis() + 18 * HOUR),
      customerName: 'Evening',
      price: 220,
      status: 'no_show',
    });
    await book({
      businessId: business._id,
      serviceId: cut._id,
      start: new Date(tomorrowStart.toMillis() + 23 * HOUR),
      customerName: 'Night',
      price: 350,
    });
    await book({
      businessId: business._id,
      serviceId: cut._id,
      start: new Date(todayStart.minus({ days: 10 }).toMillis() + 10 * HOUR),
      customerName: 'LastMonth',
      price: 40,
    });
    await book({
      businessId: business._id,
      serviceId: cut._id,
      start: new Date(week.start.getTime() - HOUR),
      customerName: 'BeforeWeek',
      price: 40,
    });

    const tomorrow = utcKey(tomorrowStart.toJSDate());
    const dayAfter = utcKey(tomorrowStart.plus({ days: 1 }).toJSDate());
    const wideFrom = utcKey(todayStart.minus({ days: 40 }).toJSDate());
    const wideTo = utcKey(todayStart.plus({ days: 10 }).toJSDate());
    const wide = `startFrom=${wideFrom}&startTo=${wideTo}`;
    const last30From = utcKey(todayStart.minus({ days: 29 }).toJSDate());
    const weekFrom = utcKey(week.start);
    const weekTo = utcKey(week.end);
    const monthFrom = utcKey(todayStart.startOf('month').toJSDate());
    const monthTo = utcKey(todayStart.startOf('month').plus({ months: 1 }).toJSDate());
    const soonDay = utcKey(soon);
    const soonNext = utcKey(DateTime.fromJSDate(soon, { zone: 'UTC' }).startOf('day').plus({ days: 1 }).toJSDate());

    expect(await namesFor(token, '')).toEqual(['Afternoon', 'Evening', 'Morning', 'Night', 'Soon']);
    expect(await namesFor(token, `startFrom=${soonDay}&startTo=${soonNext}`)).toContain('Soon');
    expect(await namesFor(token, `startFrom=${tomorrow}&startTo=${dayAfter}`)).toEqual([
      'Afternoon',
      'Evening',
      'Morning',
      'Night',
    ]);
    expect(await namesFor(token, `startFrom=${weekFrom}&startTo=${weekTo}`)).not.toContain('BeforeWeek');
    expect(await namesFor(token, `startFrom=${monthFrom}&startTo=${monthTo}`)).toContain('Soon');
    expect(await namesFor(token, `startFrom=${last30From}&startTo=${tomorrow}`)).toContain('LastMonth');
    const tomorrowWindow = `startFrom=${tomorrow}&startTo=${dayAfter}`;
    expect(await namesFor(token, `${tomorrowWindow}&status=pending`)).toEqual(['Morning']);
    expect(await namesFor(token, `${tomorrowWindow}&status=no_show`)).toEqual(['Evening']);
    expect(await namesFor(token, `${tomorrowWindow}&service=${String(color._id)}`)).toEqual(['Evening']);
    expect(await namesFor(token, `${tomorrowWindow}&source=client-online`)).toEqual(['Afternoon']);
    expect(await namesFor(token, `${tomorrowWindow}&priceMin=0&priceMax=100`)).toEqual(['Morning']);
    expect(await namesFor(token, `${tomorrowWindow}&priceMin=100&priceMax=200`)).toEqual(['Afternoon']);
    expect(await namesFor(token, `${tomorrowWindow}&priceMin=200&priceMax=350`)).toEqual(['Evening']);
    expect(await namesFor(token, `${tomorrowWindow}&priceMin=350`)).toEqual(['Night']);
    expect(await namesFor(token, `${wide}&priceMin=0&priceMax=100`)).toEqual([
      'BeforeWeek',
      'LastMonth',
      'Morning',
      'Soon',
    ]);
    expect(await namesFor(token, `${tomorrowWindow}&timeOfDay=morning`)).toEqual(['Morning']);
    expect(await namesFor(token, `${tomorrowWindow}&timeOfDay=afternoon`)).toEqual(['Afternoon']);
    expect(await namesFor(token, `${tomorrowWindow}&timeOfDay=evening`)).toEqual(['Evening']);
    expect(await namesFor(token, `${tomorrowWindow}&timeOfDay=night`)).toEqual(['Night']);
  });

  it('applies the quick filters and ANDs them with the other filters', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    const now = Date.now();
    await book({
      businessId: business._id,
      serviceId: service._id,
      start: new Date(now - 3 * HOUR),
      customerName: 'Ended',
      status: 'confirmed',
      price: 80,
    });
    await book({
      businessId: business._id,
      serviceId: service._id,
      start: new Date(now + 5 * HOUR),
      customerName: 'Later',
      status: 'confirmed',
      price: 400,
    });
    await book({
      businessId: business._id,
      serviceId: service._id,
      start: new Date(now + 6 * HOUR),
      customerName: 'Waiting',
      status: 'pending',
      price: 50,
    });
    await book({
      businessId: business._id,
      serviceId: service._id,
      start: new Date(now - 4 * HOUR),
      customerName: 'WasPending',
      status: 'pending',
      price: 50,
    });

    expect(await namesFor(token, 'queue=pending')).toEqual(['Waiting']);
    expect(await namesFor(token, 'queue=unmarked')).toEqual(['Ended']);
    expect(await namesFor(token, `queue=unmarked&startFrom=${utcKey(new Date(now - 24 * HOUR))}&startTo=${utcKey(new Date(now + 48 * HOUR))}`)).toEqual(['Ended']);
    expect(await namesFor(token, 'queue=pending&status=no_show')).toEqual([]);
    expect(await namesFor(token, 'queue=unmarked&status=pending')).toEqual([]);
    expect(await namesFor(token, 'queue=pending&priceMin=350')).toEqual([]);
    expect(await namesFor(token, 'status=confirmed&priceMin=350')).toEqual(['Later']);
  });

  it('searches customer name, phone, and service name', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const cut = await seedService(business._id);
    const color = await Service.create({
      businessId: business._id,
      name: 'Color gloss',
      durationMinutes: 60,
      price: 100,
      isActive: true,
    });
    const ada = await seedCustomer(business._id);
    ada.name = 'Ada Levi';
    ada.phone = '0501111111';
    await ada.save();
    const future = new Date(Date.now() + 4 * HOUR);
    await book({ businessId: business._id, serviceId: cut._id, customerId: ada._id, start: future, customerName: 'Ada Levi' });
    await book({
      businessId: business._id,
      serviceId: color._id,
      start: new Date(Date.now() + 5 * HOUR),
      customerName: 'Bea',
      customerPhone: '0502222222',
    });

    expect(await namesFor(token, 'search=Ada')).toEqual(['Ada Levi']);
    expect(await namesFor(token, 'search=0502222222')).toEqual(['Bea']);
    expect(await namesFor(token, 'search=gloss')).toEqual(['Bea']);
  });

  it('sorts by the allowlist and stays inside the tenant', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    await book({
      businessId: business._id,
      serviceId: service._id,
      start: new Date(Date.now() + 2 * HOUR),
      customerName: 'Bea',
      price: 40,
    });
    await book({
      businessId: business._id,
      serviceId: service._id,
      start: new Date(Date.now() + 4 * HOUR),
      customerName: 'Ada',
      price: 90,
    });
    const other = await seedOwner({ email: 'appt-tenant@test.com' });
    const otherService = await seedService(other.business._id);
    await book({
      businessId: other.business._id,
      serviceId: otherService._id,
      start: new Date(Date.now() + 3 * HOUR),
      customerName: 'Theirs',
      price: 10,
    });

    const byPrice = await request(app)
      .get('/api/appointments?page=1&sort=price&order=desc')
      .set('Authorization', `Bearer ${token}`);
    expect(byPrice.status).toBe(200);
    expect(byPrice.body.items.map((row: { customerName: string }) => row.customerName)).toEqual(['Ada', 'Bea']);

    const byName = await request(app)
      .get('/api/appointments?page=1&sort=customerName&order=asc')
      .set('Authorization', `Bearer ${token}`);
    expect(byName.body.items.map((row: { customerName: string }) => row.customerName)).toEqual(['Ada', 'Bea']);

    const rejected = await request(app)
      .get('/api/appointments?page=1&sort=notes')
      .set('Authorization', `Bearer ${token}`);
    expect(rejected.status).toBe(400);
  });

  it('publishes the sort allowlist', () => {
    expect([...APPOINTMENT_LIST_SORT_FIELDS]).toEqual([
      'start',
      'price',
      'duration',
      'customerName',
      'status',
      'serviceName',
    ]);
  });
});
