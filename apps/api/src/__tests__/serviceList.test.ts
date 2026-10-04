import request from 'supertest';
import bcrypt from 'bcryptjs';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedService, seedBusinessSettings, signTestToken } from './helpers/seed';
import { Service } from '../models/Service';
import { Appointment } from '../models/Appointment';
import { User } from '../models/User';
import { AuditLog } from '../models/AuditLog';
import { SERVICE_LIST_SORT_FIELDS } from '../validation/schemas/services';

const app = buildTestApp();

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

async function seedStaff(businessId: unknown) {
  const passwordHash = await bcrypt.hash('StaffPass123!', 4);
  const user = await User.create({
    email: 'staff-services@test.com',
    passwordHash,
    role: 'staff',
    status: 'active',
    businessId,
  });
  const token = signTestToken({
    userId: user._id.toString(),
    role: 'staff',
    email: user.email,
    businessId: String(businessId),
  });
  return { user, token };
}

async function makeService(
  businessId: unknown,
  fields: { name: string; price: number; durationMinutes: number; description?: string; isActive?: boolean }
) {
  return Service.create({ businessId, isActive: true, ...fields });
}

async function book(options: {
  businessId: unknown;
  serviceId: unknown;
  status: 'completed' | 'confirmed' | 'pending' | 'cancelled' | 'no_show';
  price: number;
  createdAt: Date;
  durationMinutes?: number;
  start?: Date;
}) {
  const minutes = options.durationMinutes ?? 60;
  const start = options.start ?? options.createdAt;
  await Appointment.create({
    businessId: options.businessId,
    serviceId: options.serviceId,
    start,
    end: new Date(start.getTime() + Math.max(minutes, 0) * 60 * 1000),
    status: options.status,
    source: 'owner',
    price: options.price,
    ...(options.durationMinutes !== undefined ? { durationMinutes: options.durationMinutes } : {}),
    createdAt: options.createdAt,
  });
}

async function namesFor(token: string, query: string): Promise<string[]> {
  const res = await request(app)
    .get(`/api/services?page=1&limit=100&${query}`)
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  return (res.body.items as { name: string }[]).map((row) => row.name).sort();
}

describe('GET /api/services list', () => {
  it('keeps the active-only array when page is omitted', async () => {
    const { business, token } = await seedOwner();
    await makeService(business._id, { name: 'Cut', price: 80, durationMinutes: 45 });
    await makeService(business._id, { name: 'Old', price: 40, durationMinutes: 30, isActive: false });
    const other = await seedOwner({ email: 'other-services@test.com' });
    await makeService(other.business._id, { name: 'Theirs', price: 10, durationMinutes: 20 });

    const res = await request(app).get('/api/services').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('Cut');
    expect('bookings' in res.body[0]).toBe(false);
  });

  it('includes inactive services only through the status filter', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    await makeService(business._id, { name: 'Cut', price: 80, durationMinutes: 45 });
    await makeService(business._id, { name: 'Old', price: 40, durationMinutes: 30, isActive: false });

    expect(await namesFor(token, 'status=active')).toEqual(['Cut']);
    expect(await namesFor(token, '')).toEqual(['Cut']);
    expect(await namesFor(token, 'status=inactive')).toEqual(['Old']);
    expect(await namesFor(token, 'status=all')).toEqual(['Cut', 'Old']);
  });

  it('stays inside the tenant on the paged list', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    await makeService(business._id, { name: 'Mine', price: 50, durationMinutes: 30 });
    const other = await seedOwner({ email: 'tenant-services@test.com' });
    await makeService(other.business._id, { name: 'Theirs', price: 50, durationMinutes: 30 });

    expect(await namesFor(token, 'status=all')).toEqual(['Mine']);
  });

  it('computes zero metrics and counts every status, including no_show', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const none = await makeService(business._id, { name: 'None', price: 100, durationMinutes: 60 });
    const missed = await makeService(business._id, { name: 'Missed', price: 100, durationMinutes: 60 });
    const free = await makeService(business._id, { name: 'Free', price: 0, durationMinutes: 60 });
    await book({
      businessId: business._id,
      serviceId: missed._id,
      status: 'no_show',
      price: 80,
      createdAt: daysAgo(2),
    });
    await book({
      businessId: business._id,
      serviceId: free._id,
      status: 'completed',
      price: 0,
      createdAt: daysAgo(1),
      durationMinutes: 60,
    });
    void none;

    const res = await request(app)
      .get('/api/services?page=1&limit=100&status=all')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(
      (res.body.items as { name: string; bookings: number; completedBookings: number; revenue: number; averageActualPrice: number; revenuePerHour: number; lastBooking: string | null }[]).map(
        (row) => [row.name, row]
      )
    );
    expect(byName['None'].bookings).toBe(0);
    expect(byName['None'].completedBookings).toBe(0);
    expect(byName['None'].revenue).toBe(0);
    expect(byName['None'].averageActualPrice).toBe(0);
    expect(byName['None'].revenuePerHour).toBe(0);
    expect(byName['None'].lastBooking).toBeNull();
    expect(byName['Missed'].bookings).toBe(1);
    expect(byName['Missed'].completedBookings).toBe(0);
    expect(byName['Missed'].revenue).toBe(0);
    expect(byName['Missed'].averageActualPrice).toBe(0);
    expect(byName['Missed'].revenuePerHour).toBe(0);
    expect(byName['Missed'].lastBooking).not.toBeNull();
    expect(byName['Free'].completedBookings).toBe(1);
    expect(byName['Free'].revenue).toBe(0);
    expect(byName['Free'].averageActualPrice).toBe(0);
    expect(byName['Free'].revenuePerHour).toBe(0);
  });

  it('computes revenue per hour from completed duration', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const hour = await makeService(business._id, { name: 'Hour', price: 100, durationMinutes: 60 });
    const split = await makeService(business._id, { name: 'Split', price: 100, durationMinutes: 30 });
    const clock = await makeService(business._id, { name: 'Clock', price: 100, durationMinutes: 60 });
    const flat = await makeService(business._id, { name: 'Flat', price: 100, durationMinutes: 60 });
    await book({
      businessId: business._id,
      serviceId: hour._id,
      status: 'completed',
      price: 120,
      createdAt: daysAgo(3),
      durationMinutes: 60,
    });
    await book({
      businessId: business._id,
      serviceId: split._id,
      status: 'completed',
      price: 60,
      createdAt: daysAgo(3),
      durationMinutes: 30,
    });
    await book({
      businessId: business._id,
      serviceId: split._id,
      status: 'completed',
      price: 60,
      createdAt: daysAgo(2),
      durationMinutes: 30,
    });
    const clockStart = daysAgo(4);
    await book({
      businessId: business._id,
      serviceId: clock._id,
      status: 'completed',
      price: 60,
      createdAt: clockStart,
      start: clockStart,
      durationMinutes: 0,
    });
    await Appointment.updateOne(
      { serviceId: clock._id },
      { $set: { end: new Date(clockStart.getTime() + 60 * 60 * 1000), durationMinutes: 0 } }
    );
    const flatStart = daysAgo(1);
    await book({
      businessId: business._id,
      serviceId: flat._id,
      status: 'completed',
      price: 90,
      createdAt: flatStart,
      start: flatStart,
      durationMinutes: 0,
    });

    const res = await request(app)
      .get('/api/services?page=1&limit=100&status=all')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(
      (res.body.items as { name: string; revenue: number; averageActualPrice: number; revenuePerHour: number; completedBookings: number }[]).map(
        (row) => [row.name, row]
      )
    );
    expect(byName['Hour'].revenue).toBe(120);
    expect(byName['Hour'].averageActualPrice).toBe(120);
    expect(byName['Hour'].revenuePerHour).toBe(120);
    expect(byName['Split'].revenue).toBe(120);
    expect(byName['Split'].completedBookings).toBe(2);
    expect(byName['Split'].averageActualPrice).toBe(60);
    expect(byName['Split'].revenuePerHour).toBe(120);
    expect(byName['Clock'].revenuePerHour).toBe(60);
    expect(byName['Flat'].revenue).toBe(90);
    expect(byName['Flat'].averageActualPrice).toBe(90);
    expect(byName['Flat'].revenuePerHour).toBe(0);
  });

  it('applies half-open price, duration, booking, and revenue presets', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const rows = [
      { name: 'P0', price: 0, durationMinutes: 20 },
      { name: 'P99', price: 99, durationMinutes: 29 },
      { name: 'P100', price: 100, durationMinutes: 30 },
      { name: 'P199', price: 199, durationMinutes: 59 },
      { name: 'P200', price: 200, durationMinutes: 60 },
      { name: 'P349', price: 349, durationMinutes: 89 },
      { name: 'P350', price: 350, durationMinutes: 90 },
      { name: 'P119', price: 10, durationMinutes: 119 },
      { name: 'P120', price: 400, durationMinutes: 120 },
    ];
    for (const row of rows) {
      await makeService(business._id, row);
    }
    const priced = await makeService(business._id, { name: 'Rev499', price: 10, durationMinutes: 30 });
    const edge = await makeService(business._id, { name: 'Rev500', price: 10, durationMinutes: 30 });
    const mid = await makeService(business._id, { name: 'Rev1000', price: 10, durationMinutes: 30 });
    const top = await makeService(business._id, { name: 'Rev2500', price: 10, durationMinutes: 30 });
    await book({ businessId: business._id, serviceId: priced._id, status: 'completed', price: 499, createdAt: daysAgo(1), durationMinutes: 60 });
    await book({ businessId: business._id, serviceId: edge._id, status: 'completed', price: 500, createdAt: daysAgo(1), durationMinutes: 60 });
    await book({ businessId: business._id, serviceId: mid._id, status: 'completed', price: 1000, createdAt: daysAgo(1), durationMinutes: 60 });
    await book({ businessId: business._id, serviceId: top._id, status: 'completed', price: 2500, createdAt: daysAgo(1), durationMinutes: 60 });

    expect(await namesFor(token, 'priceMin=0&priceMax=100')).toEqual(['P0', 'P119', 'P99', 'Rev1000', 'Rev2500', 'Rev499', 'Rev500']);
    expect(await namesFor(token, 'priceMin=100&priceMax=200')).toEqual(['P100', 'P199']);
    expect(await namesFor(token, 'priceMin=200&priceMax=350')).toEqual(['P200', 'P349']);
    expect(await namesFor(token, 'priceMin=350')).toEqual(['P120', 'P350']);

    expect(await namesFor(token, 'durationMax=30')).toEqual(['P0', 'P99']);
    expect(await namesFor(token, 'durationMin=30&durationMax=60')).toEqual(['P100', 'P199', 'Rev1000', 'Rev2500', 'Rev499', 'Rev500']);
    expect(await namesFor(token, 'durationMin=60&durationMax=90')).toEqual(['P200', 'P349']);
    expect(await namesFor(token, 'durationMin=90&durationMax=120')).toEqual(['P119', 'P350']);
    expect(await namesFor(token, 'durationMin=120')).toEqual(['P120']);

    expect(await namesFor(token, 'revenueMin=0&revenueMax=500')).toEqual(['P0', 'P100', 'P119', 'P120', 'P199', 'P200', 'P349', 'P350', 'P99', 'Rev499']);
    expect(await namesFor(token, 'revenueMin=500&revenueMax=1000')).toEqual(['Rev500']);
    expect(await namesFor(token, 'revenueMin=1000&revenueMax=2500')).toEqual(['Rev1000']);
    expect(await namesFor(token, 'revenueMin=2500')).toEqual(['Rev2500']);
  });

  it('applies booking presets on the half-open bounds', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const counts = [0, 1, 10, 11, 25, 26, 50, 51];
    for (const count of counts) {
      const service = await makeService(business._id, {
        name: `B${count}`,
        price: 10,
        durationMinutes: 30,
      });
      for (let index = 0; index < count; index += 1) {
        await book({
          businessId: business._id,
          serviceId: service._id,
          status: 'cancelled',
          price: 0,
          createdAt: daysAgo(1),
          durationMinutes: 30,
        });
      }
    }

    expect(await namesFor(token, 'bookingsMax=1')).toEqual(['B0']);
    expect(await namesFor(token, 'bookingsMin=1&bookingsMax=11')).toEqual(['B1', 'B10']);
    expect(await namesFor(token, 'bookingsMin=11&bookingsMax=26')).toEqual(['B11', 'B25']);
    expect(await namesFor(token, 'bookingsMin=26&bookingsMax=51')).toEqual(['B26', 'B50']);
    expect(await namesFor(token, 'bookingsMin=50')).toEqual(['B50', 'B51']);
  });

  it('applies each activity value and excludes never-booked from the age filters', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    await makeService(business._id, { name: 'Never', price: 10, durationMinutes: 30 });
    const recent = await makeService(business._id, { name: 'Recent', price: 10, durationMinutes: 30 });
    const over30 = await makeService(business._id, { name: 'Over30', price: 10, durationMinutes: 30 });
    const over60 = await makeService(business._id, { name: 'Over60', price: 10, durationMinutes: 30 });
    const over90 = await makeService(business._id, { name: 'Over90', price: 10, durationMinutes: 30 });
    await book({ businessId: business._id, serviceId: recent._id, status: 'cancelled', price: 0, createdAt: daysAgo(10) });
    await book({ businessId: business._id, serviceId: over30._id, status: 'pending', price: 0, createdAt: daysAgo(40) });
    await book({ businessId: business._id, serviceId: over60._id, status: 'confirmed', price: 0, createdAt: daysAgo(70) });
    await book({ businessId: business._id, serviceId: over90._id, status: 'no_show', price: 0, createdAt: daysAgo(100) });

    expect(await namesFor(token, 'activity=neverBooked')).toEqual(['Never']);
    expect(await namesFor(token, 'activity=noBookingsIn30')).toEqual(['Over30', 'Over60', 'Over90']);
    expect(await namesFor(token, 'activity=noBookingsIn60')).toEqual(['Over60', 'Over90']);
    expect(await namesFor(token, 'activity=noBookingsIn90')).toEqual(['Over90']);
  });

  it('ANDs neverBooked with a booking range, which is empty', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    await makeService(business._id, { name: 'Never', price: 10, durationMinutes: 30 });
    const busy = await makeService(business._id, { name: 'Busy', price: 10, durationMinutes: 30 });
    for (let index = 0; index < 5; index += 1) {
      await book({
        businessId: business._id,
        serviceId: busy._id,
        status: 'completed',
        price: 20,
        createdAt: daysAgo(40),
        durationMinutes: 30,
      });
    }

    expect(await namesFor(token, 'bookingsMin=1&bookingsMax=11')).toEqual(['Busy']);
    expect(await namesFor(token, 'activity=neverBooked&bookingsMin=1&bookingsMax=11')).toEqual([]);
    expect(await namesFor(token, 'activity=noBookingsIn30&bookingsMin=1&bookingsMax=11')).toEqual(['Busy']);
  });

  it('searches name and description', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    await makeService(business._id, { name: 'Cut', price: 40, durationMinutes: 30, description: 'short trim' });
    await makeService(business._id, { name: 'Color gloss', price: 80, durationMinutes: 60, description: 'full' });

    expect(await namesFor(token, 'search=gloss')).toEqual(['Color gloss']);
    expect(await namesFor(token, 'search=trim')).toEqual(['Cut']);
  });

  it('rejects metric filters, metric sorts, export, and bulk for staff', async () => {
    const { business } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await makeService(business._id, { name: 'Cut', price: 40, durationMinutes: 30 });
    const { token } = await seedStaff(business._id);

    const listed = await request(app)
      .get('/api/services?page=1&sort=name')
      .set('Authorization', `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.items.length).toBe(1);
    expect('revenue' in listed.body.items[0]).toBe(false);
    expect('bookings' in listed.body.items[0]).toBe(false);

    const activity = await request(app)
      .get('/api/services?page=1&activity=neverBooked')
      .set('Authorization', `Bearer ${token}`);
    const sorted = await request(app)
      .get('/api/services?page=1&sort=revenue')
      .set('Authorization', `Bearer ${token}`);
    const exported = await request(app)
      .get('/api/services/export')
      .set('Authorization', `Bearer ${token}`);
    const bulk = await request(app)
      .post('/api/services/bulk-status')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [service._id.toString()], isActive: false });
    expect(activity.status).toBe(403);
    expect(sorted.status).toBe(403);
    expect(exported.status).toBe(403);
    expect(bulk.status).toBe(403);
  });

  it('exports the filtered set and audits each bulk status change', async () => {
    const { business, token, user } = await seedOwner();
    await seedBusinessSettings(business._id);
    const cut = await makeService(business._id, { name: 'Cut', price: 40, durationMinutes: 30 });
    await makeService(business._id, { name: 'Color', price: 80, durationMinutes: 60, isActive: false });

    const exported = await request(app)
      .get('/api/services/export?status=all')
      .set('Authorization', `Bearer ${token}`);
    expect(exported.status).toBe(200);
    expect(exported.headers['content-type']).toContain('text/csv');
    expect(exported.text).toContain('Cut');
    expect(exported.text).toContain('Color');

    const bulk = await request(app)
      .post('/api/services/bulk-status')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [cut._id.toString()], isActive: false });
    expect(bulk.status).toBe(200);
    expect(bulk.body.updated).toBe(1);
    const saved = await Service.findById(cut._id);
    expect(saved?.isActive).toBe(false);

    const audits = await AuditLog.find({ actorUserId: user._id }).lean();
    const actions = audits.map((row) => row.action).sort();
    expect(actions).toEqual(['service.deactivated', 'service.exported']);
  });

  it('publishes the sort allowlist', () => {
    expect([...SERVICE_LIST_SORT_FIELDS]).toEqual([
      'name',
      'price',
      'duration',
      'bookings',
      'revenue',
      'averageActualPrice',
      'revenuePerHour',
      'lastBooking',
      'createdAt',
    ]);
  });

  it('indexes appointments by business, service, and status', () => {
    const found = Appointment.schema.indexes().some(([fields]) => {
      const spec = fields as Record<string, number>;
      return spec.businessId === 1 && spec.serviceId === 1 && spec.status === 1;
    });
    expect(found).toBe(true);
  });
});
