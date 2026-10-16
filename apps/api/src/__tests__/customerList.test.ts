import request from 'supertest';
import bcrypt from 'bcryptjs';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedService, seedBusinessSettings, signTestToken } from './helpers/seed';
import { Customer } from '../models/Customer';
import { Appointment } from '../models/Appointment';
import { User } from '../models/User';
import { AuditLog } from '../models/AuditLog';
import { CUSTOMER_LIST_SORT_FIELDS } from '../validation/schemas/customers';

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
    email: 'staff-list@test.com',
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

describe('GET /api/customers paged list', () => {
  it('keeps the legacy array, including isActive, when page is omitted', async () => {
    const { business, token } = await seedOwner();
    await Customer.create({ businessId: business._id, name: 'Ada', phone: '0501111111', isActive: false });

    const res = await request(app).get('/api/customers').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].isActive).toBe(false);
  });

  it('defaults to active customers and computes canonical metrics', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    const active = await Customer.create({ businessId: business._id, name: 'Ada', phone: '0501111111' });
    await Customer.create({ businessId: business._id, name: 'Bea', phone: '0502222222', isActive: false });
    await Appointment.create({
      businessId: business._id,
      customerId: active._id,
      serviceId: service._id,
      start: daysAgo(4),
      end: new Date(daysAgo(4).getTime() + 60 * 60 * 1000),
      status: 'completed',
      source: 'owner',
      price: 40,
    });
    await Appointment.create({
      businessId: business._id,
      customerId: active._id,
      serviceId: service._id,
      start: daysAgo(1),
      end: new Date(daysAgo(1).getTime() + 60 * 60 * 1000),
      status: 'completed',
      source: 'owner',
      price: 60,
    });
    const upcoming = new Date(Date.now() + DAY_MS);
    await Appointment.create({
      businessId: business._id,
      customerId: active._id,
      serviceId: service._id,
      start: upcoming,
      end: new Date(upcoming.getTime() + 60 * 60 * 1000),
      status: 'confirmed',
      source: 'owner',
    });

    const res = await request(app)
      .get('/api/customers?page=1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items.length).toBe(1);
    const row = res.body.items[0];
    expect(row.name).toBe('Ada');
    expect(row.isActive).toBe(true);
    expect(row.totalVisits).toBe(2);
    expect(row.totalRevenue).toBe(100);
    expect(row.averageVisitValue).toBe(50);
    expect(row.customerType).toBe('returning');
    expect(row.preferredServiceName).toBe('Haircut');
    expect(row.nextAppointment).toBeTruthy();
    expect(Math.abs(new Date(row.lastVisit).getTime() - daysAgo(1).getTime())).toBeLessThan(60_000);
  });

  it('applies search together with a metric filter and sorts by a computed field', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    const returning = await Customer.create({ businessId: business._id, name: 'Dana One', phone: '0503333331' });
    const newer = await Customer.create({ businessId: business._id, name: 'Dana Two', phone: '0503333332' });
    for (const start of [daysAgo(8), daysAgo(2)]) {
      await Appointment.create({
        businessId: business._id,
        customerId: returning._id,
        serviceId: service._id,
        start,
        end: new Date(start.getTime() + 60 * 60 * 1000),
        status: 'completed',
        source: 'owner',
        price: 10,
      });
    }
    await Appointment.create({
      businessId: business._id,
      customerId: newer._id,
      serviceId: service._id,
      start: daysAgo(3),
      end: new Date(daysAgo(3).getTime() + 60 * 60 * 1000),
      status: 'completed',
      source: 'owner',
      price: 10,
    });

    const res = await request(app)
      .get('/api/customers?page=1&search=Dana&customerType=returning&sort=totalVisits&order=desc')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]._id).toBe(returning._id.toString());
    expect(res.body.items[0].totalVisits).toBe(2);
  });

  it('pages 26 customers and stays inside the tenant', async () => {
    const { business, token } = await seedOwner();
    const other = await seedOwner({ email: 'other-list@test.com' });
    await Customer.insertMany(
      Array.from({ length: 26 }, (_, index) => ({
        businessId: business._id,
        name: `Guest ${String(index).padStart(2, '0')}`,
        phone: `050100${String(index).padStart(4, '0')}`,
      }))
    );
    await Customer.create({ businessId: other.business._id, name: 'Outsider', phone: '0501999999' });

    const first = await request(app)
      .get('/api/customers?page=1&status=all')
      .set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);
    expect(first.body.total).toBe(26);
    expect(first.body.items.length).toBe(25);

    const second = await request(app)
      .get('/api/customers?page=2&status=all')
      .set('Authorization', `Bearer ${token}`);
    expect(second.body.items.length).toBe(1);
    expect(second.body.items[0].name).not.toBe('Outsider');
  });

  it('counts no-shows that are not excused', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    const customer = await Customer.create({
      businessId: business._id,
      name: 'No Show',
      phone: '0504444444',
    });
    await Appointment.create({
      businessId: business._id,
      customerId: customer._id,
      serviceId: service._id,
      start: daysAgo(9),
      end: new Date(daysAgo(9).getTime() + 60 * 60 * 1000),
      status: 'no_show',
      source: 'owner',
      noShowExcused: true,
    });
    await Appointment.create({
      businessId: business._id,
      customerId: customer._id,
      serviceId: service._id,
      start: daysAgo(1),
      end: new Date(daysAgo(1).getTime() + 60 * 60 * 1000),
      status: 'no_show',
      source: 'owner',
    });

    const res = await request(app)
      .get('/api/customers?page=1&status=all')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.items[0].noShowCount).toBe(1);
  });

  it('rejects metric access, bulk, and export for staff', async () => {
    const { business } = await seedOwner();
    const { token } = await seedStaff(business._id);
    await Customer.create({ businessId: business._id, name: 'Ada', phone: '0505555555' });

    const list = await request(app)
      .get('/api/customers?page=1&status=all')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.items[0].name).toBe('Ada');
    expect(list.body.items[0].totalVisits).toBeUndefined();

    const sorted = await request(app)
      .get('/api/customers?page=1&sort=totalVisits')
      .set('Authorization', `Bearer ${token}`);
    expect(sorted.status).toBe(403);

    const exported = await request(app)
      .get('/api/customers/export')
      .set('Authorization', `Bearer ${token}`);
    expect(exported.status).toBe(403);

    const bulk = await request(app)
      .post('/api/customers/bulk-status')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [list.body.items[0]._id], isActive: false });
    expect(bulk.status).toBe(403);
  });

  it('records the impersonating super-admin on export and bulk', async () => {
    const { business } = await seedOwner();
    const passwordHash = await bcrypt.hash('Admin123!', 4);
    const admin = await User.create({
      email: 'impersonator@test.com',
      passwordHash,
      role: 'super_admin',
      status: 'active',
    });
    const token = signTestToken({
      userId: admin._id.toString(),
      role: 'super_admin',
      email: admin.email,
      impersonating: true,
      impersonatingBusinessId: business._id.toString(),
    });
    const customer = await Customer.create({ businessId: business._id, name: 'Ada', phone: '0506666666' });

    const exported = await request(app)
      .get('/api/customers/export?status=all')
      .set('Authorization', `Bearer ${token}`);
    expect(exported.status).toBe(200);
    expect(exported.headers['content-type']).toContain('text/csv');
    expect(exported.text).toContain('Ada');

    const bulk = await request(app)
      .post('/api/customers/bulk-status')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [customer._id.toString()], isActive: false });
    expect(bulk.status).toBe(200);
    expect(bulk.body.updated).toBe(1);

    const audits = await AuditLog.find({ actorUserId: admin._id }).lean();
    const actions = audits.map((row) => row.action).sort();
    expect(actions).toEqual(['customer.deactivated', 'customer.exported']);
  });

  it('accepts only the published sort allowlist', () => {
    expect([...CUSTOMER_LIST_SORT_FIELDS]).toEqual([
      'name',
      'phone',
      'createdAt',
      'totalVisits',
      'totalRevenue',
      'averageVisitValue',
      'lastVisit',
      'nextAppointment',
      'noShowCount',
    ]);
  });
});

describe('customer activity filters', () => {
  async function book(
    businessId: unknown,
    customerId: unknown,
    serviceId: unknown,
    start: Date,
    status: 'completed' | 'confirmed' | 'pending' | 'cancelled'
  ) {
    await Appointment.create({
      businessId,
      customerId,
      serviceId,
      start,
      end: new Date(start.getTime() + 60 * 60 * 1000),
      status,
      source: 'owner',
      price: 50,
    });
  }

  async function seedActivitySet() {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    const biz = business._id;
    const sid = service._id;
    await Customer.create({ businessId: biz, name: 'None', phone: '0501000001' });
    const recent = await Customer.create({ businessId: biz, name: 'Recent', phone: '0501000002' });
    const over30 = await Customer.create({ businessId: biz, name: 'Over30', phone: '0501000003' });
    const over60 = await Customer.create({ businessId: biz, name: 'Over60', phone: '0501000004' });
    const over90 = await Customer.create({ businessId: biz, name: 'Over90', phone: '0501000005' });
    const booked = await Customer.create({ businessId: biz, name: 'Booked', phone: '0501000006' });
    const pendingSoon = await Customer.create({ businessId: biz, name: 'PendingSoon', phone: '0501000007' });
    const cancelled = await Customer.create({ businessId: biz, name: 'Cancelled', phone: '0501000008' });
    const busy = await Customer.create({ businessId: biz, name: 'Busy', phone: '0501000009' });
    const pastPending = await Customer.create({ businessId: biz, name: 'PastPending', phone: '0501000010' });

    await book(biz, recent._id, sid, daysAgo(10), 'completed');
    await book(biz, over30._id, sid, daysAgo(40), 'completed');
    await book(biz, over60._id, sid, daysAgo(70), 'completed');
    await book(biz, over90._id, sid, daysAgo(100), 'completed');
    await book(biz, booked._id, sid, daysAgo(40), 'completed');
    await book(biz, booked._id, sid, new Date(Date.now() + 2 * DAY_MS), 'confirmed');
    await book(biz, pendingSoon._id, sid, daysAgo(10), 'completed');
    await book(biz, pendingSoon._id, sid, new Date(Date.now() + 2 * DAY_MS), 'pending');
    await book(biz, cancelled._id, sid, new Date(Date.now() + 2 * DAY_MS), 'cancelled');
    await book(biz, busy._id, sid, daysAgo(20), 'completed');
    await book(biz, busy._id, sid, daysAgo(8), 'completed');
    await book(biz, busy._id, sid, daysAgo(2), 'completed');
    await book(biz, pastPending._id, sid, daysAgo(40), 'completed');
    await book(biz, pastPending._id, sid, daysAgo(1), 'pending');
    return token;
  }

  async function namesFor(token: string, query: string): Promise<string[]> {
    const res = await request(app)
      .get(`/api/customers?page=1&limit=100&status=all&${query}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return (res.body.items as { name: string }[]).map((row) => row.name).sort();
  }

  it('noVisits includes only customers with no completed visit', async () => {
    const token = await seedActivitySet();
    expect(await namesFor(token, 'activity=noVisits')).toEqual(['Cancelled', 'None']);
  });

  it('noUpcoming excludes pending and confirmed appointments that start after now', async () => {
    const token = await seedActivitySet();
    expect(await namesFor(token, 'activity=noUpcoming')).toEqual([
      'Busy',
      'Cancelled',
      'None',
      'Over30',
      'Over60',
      'Over90',
      'PastPending',
      'Recent',
    ]);
  });

  it('lastVisitOver30 requires a completed visit older than 30 days', async () => {
    const token = await seedActivitySet();
    expect(await namesFor(token, 'activity=lastVisitOver30')).toEqual([
      'Booked',
      'Over30',
      'Over60',
      'Over90',
      'PastPending',
    ]);
  });

  it('lastVisitOver60 requires a completed visit older than 60 days', async () => {
    const token = await seedActivitySet();
    expect(await namesFor(token, 'activity=lastVisitOver60')).toEqual(['Over60', 'Over90']);
  });

  it('lastVisitOver90 requires a completed visit older than 90 days', async () => {
    const token = await seedActivitySet();
    expect(await namesFor(token, 'activity=lastVisitOver90')).toEqual(['Over90']);
  });

  it('ANDs noVisits with a visit range, which is empty', async () => {
    const token = await seedActivitySet();
    expect(await namesFor(token, 'visitsMin=2&visitsMax=6')).toEqual(['Busy']);
    expect(await namesFor(token, 'activity=noVisits&visitsMin=2&visitsMax=6')).toEqual([]);
  });

  it('rejects the retired recent and lapsed activity values', async () => {
    const token = await seedActivitySet();
    const recent = await request(app)
      .get('/api/customers?page=1&activity=recent')
      .set('Authorization', `Bearer ${token}`);
    const lapsed = await request(app)
      .get('/api/customers?page=1&activity=lapsed')
      .set('Authorization', `Bearer ${token}`);
    expect(recent.status).toBe(400);
    expect(lapsed.status).toBe(400);
  });
});

describe('customer phone writes', () => {
  it('rejects a non-mobile phone on owner create and stores a mobile canonically', async () => {
    const { token } = await seedOwner();
    const rejected = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad', phone: '111' });
    expect(rejected.status).toBe(400);

    const landline = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Landline', phone: '02-1234567' });
    expect(landline.status).toBe(400);

    const otherPrefix = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Other', phone: '0721234567' });
    expect(otherPrefix.status).toBe(400);

    const created = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mobile', phone: '050-1234567' });
    expect(created.status).toBe(201);
    expect(created.body.phone).toBe('0501234567');
  });
});
