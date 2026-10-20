import request from 'supertest';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedService, seedBusinessSettings, seedCustomer } from './helpers/seed';
import { loginPublicClient } from './helpers/publicSession';
import { Appointment } from '../models/Appointment';
import { AvailabilityOverride } from '../models/AvailabilityOverride';
import { BusinessSettings } from '../models/BusinessSettings';
import { Customer } from '../models/Customer';
import { CustomerServiceConfig } from '../models/CustomerServiceConfig';

const app = buildTestApp();

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => {
  delete process.env.IDENTITY_MODE;
  await dbClear();
});
afterEach(() => {
  delete process.env.IDENTITY_MODE;
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD in UTC (the test business runs on UTC). */
function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function inDays(days: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return new Date(date.getTime() + days * DAY_MS);
}

/** The first date on or after today+minOffset that falls on `weekday` (0 = Sunday). */
function nextWeekday(weekday: number, minOffset: number): Date {
  let date = inDays(minOffset);
  while (date.getUTCDay() !== weekday) date = new Date(date.getTime() + DAY_MS);
  return date;
}

const OPEN_09_TO_17 = [0, 1, 2, 3, 4, 5, 6].map((day) =>
  day === 6 ? { day, isOpen: false, ranges: [] } : { day, isOpen: true, ranges: [{ start: '09:00', end: '17:00' }] }
);

async function setup(options: { hours?: typeof OPEN_09_TO_17; rules?: Record<string, unknown> } = {}) {
  const { business } = await seedOwner();
  await seedBusinessSettings(business._id);
  const service = await seedService(business._id); // 60 minutes
  await BusinessSettings.updateOne(
    { businessId: business._id },
    {
      $set: {
        openingHours: { slotStepMinutes: 30, days: options.hours ?? OPEN_09_TO_17 },
        'onlineBooking.maxAdvanceDays': 120,
        'onlineBooking.minLeadMinutes': 0,
        ...(options.rules ?? {}),
      },
    }
  );
  return { business, service };
}

function month(businessId: string, serviceId: string, value: string, cookie?: string) {
  const req = request(app).get(`/api/public/availability/month?businessId=${businessId}&serviceId=${serviceId}&month=${value}`);
  return cookie ? req.set('Cookie', cookie) : req;
}

async function bookedSolid(businessId: unknown, serviceId: unknown, date: Date, from = '09:00', to = '17:00') {
  const day = iso(date);
  const customer = await seedCustomer(businessId as string);
  return Appointment.create({
    businessId,
    customerId: customer._id,
    serviceId,
    start: new Date(`${day}T${from}:00.000Z`),
    end: new Date(`${day}T${to}:00.000Z`),
    status: 'confirmed',
    source: 'owner',
  });
}

describe('MONTH AVAILABILITY (the date picker\'s enabled days)', () => {
  it('leaves out days the business is closed, and includes the open ones', async () => {
    const { business, service } = await setup();
    const target = nextWeekday(3, 3); // a Wednesday, a few days out
    const res = await month(business._id.toString(), service._id.toString(), iso(target).slice(0, 7));
    expect(res.status).toBe(200);
    const days = res.body.availableDays as string[];
    expect(days).toContain(iso(target));
    for (const day of days) expect(new Date(`${day}T00:00:00Z`).getUTCDay()).not.toBe(6);
    // Every Saturday of the month is missing; every other bookable day is there.
    const saturday = nextWeekday(6, 3);
    if (iso(saturday).slice(0, 7) === iso(target).slice(0, 7)) expect(days).not.toContain(iso(saturday));
    expect(res.body.durationMinutes).toBe(60);
  });

  it('leaves out a fully booked day, and agrees with the per-day availability for every day', async () => {
    const { business, service } = await setup();
    const full = nextWeekday(2, 4);
    await bookedSolid(business._id, service._id, full);

    const value = iso(full).slice(0, 7);
    const res = await month(business._id.toString(), service._id.toString(), value);
    const days = res.body.availableDays as string[];
    expect(days).not.toContain(iso(full));

    // The month answer must equal "this day has slots" for each day of it.
    const [year, monthNumber] = value.split('-').map(Number);
    const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    for (let day = 1; day <= last; day++) {
      const key = `${value}-${String(day).padStart(2, '0')}`;
      if (key < iso(inDays(0))) continue;
      const perDay = await request(app).get(
        `/api/public/availability?businessId=${business._id.toString()}&serviceId=${service._id.toString()}&date=${key}`
      );
      const hasSlots = perDay.status === 200 && (perDay.body.slots as string[]).length > 0;
      if (hasSlots !== days.includes(key)) {
        throw new Error(`${key}: per-day has slots=${hasSlots}, month says ${days.includes(key)}`);
      }
    }
  });

  it('leaves out a day the owner closed with an override', async () => {
    const { business, service } = await setup();
    const day = nextWeekday(4, 3);
    const before = await month(business._id.toString(), service._id.toString(), iso(day).slice(0, 7));
    expect(before.body.availableDays).toContain(iso(day));
    await AvailabilityOverride.create({ businessId: business._id, date: iso(day), type: 'closed', ranges: [] });
    const after = await month(business._id.toString(), service._id.toString(), iso(day).slice(0, 7));
    expect(after.body.availableDays).not.toContain(iso(day));
    expect((after.body.availableDays as string[]).length).toBe((before.body.availableDays as string[]).length - 1);
  });

  it('stops at maxAdvanceDays and starts at today', async () => {
    const { business, service } = await setup({ rules: { 'onlineBooking.maxAdvanceDays': 7 } });
    const res = await month(business._id.toString(), service._id.toString(), iso(inDays(0)).slice(0, 7));
    const days = res.body.availableDays as string[];
    for (const day of days) {
      expect(day >= iso(inDays(0))).toBe(true);
      expect(day <= iso(inDays(7))).toBe(true);
    }
    // A month wholly beyond the horizon has nothing, and nothing to offer later either.
    const far = await month(business._id.toString(), service._id.toString(), iso(inDays(70)).slice(0, 7));
    expect(far.body.availableDays).toEqual([]);
    expect(far.body.firstAvailable).toBeNull();
  });

  it('drops days that the minimum lead time wipes out', async () => {
    const { business, service } = await setup({ rules: { 'onlineBooking.minLeadMinutes': 1440 } });
    const res = await month(business._id.toString(), service._id.toString(), iso(inDays(0)).slice(0, 7));
    // Nothing today can start 24 hours from now.
    expect(res.body.availableDays).not.toContain(iso(inDays(0)));
  });

  it('counts the buffer between appointments', async () => {
    const shortDay = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, isOpen: true, ranges: [{ start: '09:00', end: '11:00' }] }));
    const target = nextWeekday(3, 3);
    const value = iso(target).slice(0, 7);

    const open = await setup({ hours: shortDay });
    await bookedSolid(open.business._id, open.service._id, target, '09:00', '10:00');
    const noBuffer = await month(open.business._id.toString(), open.service._id.toString(), value);
    expect(noBuffer.body.availableDays).toContain(iso(target)); // 10:00-11:00 is still free

    await BusinessSettings.updateOne({ businessId: open.business._id }, { $set: { 'onlineBooking.bufferMinutes': 30 } });
    const buffered = await month(open.business._id.toString(), open.service._id.toString(), value);
    expect(buffered.body.availableDays).not.toContain(iso(target)); // the buffer pushes 10:00 past closing
  });

  it('uses the client\'s own effective duration, not the catalog one', async () => {
    process.env.IDENTITY_MODE = 'phone';
    const { business, service } = await setup();
    const customer = await Customer.create({ businessId: business._id, name: 'Noa Levi', phone: '0507000001' });
    // Ten hours cannot fit in a 09:00-17:00 day.
    await CustomerServiceConfig.create({
      businessId: business._id,
      customerId: customer._id,
      serviceId: service._id,
      durationOverrideMinutes: 600,
    });
    const session = await loginPublicClient(app, business.slug, '0507000001');
    const value = iso(nextWeekday(3, 3)).slice(0, 7);

    const anonymous = await month(business._id.toString(), service._id.toString(), value);
    expect((anonymous.body.availableDays as string[]).length).toBeGreaterThan(0);
    expect(anonymous.body.durationMinutes).toBe(60);

    const asClient = await month(business._id.toString(), service._id.toString(), value, session.cookie);
    expect(asClient.body.availableDays).toEqual([]);
    expect(asClient.body.firstAvailable).toBeNull();
    expect(asClient.body.durationMinutes).toBe(600);
  });

  it('names the first available day, even when it is in a later month', async () => {
    const { business, service } = await setup();
    const now = inDays(0);
    const current = await month(business._id.toString(), service._id.toString(), iso(now).slice(0, 7));
    const currentDays = current.body.availableDays as string[];
    expect(current.body.firstAvailable).toBe(currentDays[0] ?? current.body.firstAvailable);

    // Asking about last month: it has nothing, but the next bookable day is still reported.
    const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
    const past = await month(business._id.toString(), service._id.toString(), iso(previous).slice(0, 7));
    expect(past.body.availableDays).toEqual([]);
    expect(past.body.firstAvailable).toBe(currentDays[0] ?? past.body.firstAvailable);
    expect(typeof past.body.firstAvailable).toBe('string');
    expect(past.body.firstAvailable >= iso(now)).toBe(true);

    // And across a month boundary when the current month has nothing left.
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1));
    const later = await month(business._id.toString(), service._id.toString(), iso(nextMonth).slice(0, 7));
    expect((later.body.availableDays as string[])[0]).toBe(later.body.firstAvailable);
  });

  it('answers on the slug route too, with the same days', async () => {
    const { business, service } = await setup();
    const value = iso(nextWeekday(3, 3)).slice(0, 7);
    const byId = await month(business._id.toString(), service._id.toString(), value);
    const bySlug = await request(app).get(
      `/api/public/businesses/${business.slug}/availability/month?serviceId=${service._id.toString()}&month=${value}`
    );
    expect(bySlug.status).toBe(200);
    expect(bySlug.body.availableDays).toEqual(byId.body.availableDays);
  });

  it('rejects bad input and closed booking', async () => {
    const { business, service } = await setup();
    const id = business._id.toString();
    const sid = service._id.toString();
    expect((await month(id, sid, '2026-13')).status).toBe(400);
    expect((await month(id, sid, '2026-1')).status).toBe(400);
    expect((await request(app).get(`/api/public/availability/month?businessId=${id}&month=2026-10`)).status).toBe(400);
    expect((await month('64b7f0f0f0f0f0f0f0f0f0f0', sid, '2026-10')).status).toBe(404);
    expect((await month(id, '64b7f0f0f0f0f0f0f0f0f0f0', '2026-10')).status).toBe(404);

    await BusinessSettings.updateOne({ businessId: business._id }, { $set: { 'onlineBooking.enabled': false } });
    expect((await month(id, sid, iso(inDays(1)).slice(0, 7))).status).toBe(403);
  });
});
