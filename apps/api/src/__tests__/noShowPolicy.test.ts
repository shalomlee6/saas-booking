import request from 'supertest';
import bcrypt from 'bcryptjs';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedService, seedBusinessSettings, signTestToken } from './helpers/seed';
import { Customer } from '../models/Customer';
import { Appointment } from '../models/Appointment';
import { User } from '../models/User';
import { AuditLog } from '../models/AuditLog';
import { BusinessSettings } from '../models/BusinessSettings';
import { ONLINE_BOOKING_UNAVAILABLE, PUBLIC_MOBILE_REQUIRED } from '../services/publicBookingPolicy';

const app = buildTestApp();

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

function tomorrowKey(): string {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

function book(
  businessId: string,
  serviceId: string,
  phone: string,
  time: string,
  extra: { name?: string; language?: string; token?: string } = {}
) {
  const req = request(app).post('/api/public/appointments');
  if (extra.language) req.set('Accept-Language', extra.language);
  if (extra.token) req.set('Authorization', `Bearer ${extra.token}`);
  const body: Record<string, string> = {
    businessId,
    serviceId,
    date: tomorrowKey(),
    time,
  };
  if (!extra.token) {
    body.customerName = extra.name ?? 'Guest';
    body.customerPhone = phone;
  }
  return req.send(body);
}

async function addNoShows(
  businessId: unknown,
  customerId: unknown,
  serviceId: unknown,
  count: number
) {
  for (let i = 0; i < count; i++) {
    const start = new Date(Date.now() - (i + 2) * 24 * 60 * 60 * 1000);
    await Appointment.create({
      businessId,
      customerId,
      serviceId,
      start,
      end: new Date(start.getTime() + 60 * 60 * 1000),
      status: 'no_show',
      source: 'owner',
    });
  }
}

async function seedStaff(businessId: unknown) {
  const passwordHash = await bcrypt.hash('StaffPass123!', 4);
  const user = await User.create({
    email: 'staff-policy@test.com',
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

describe('NO-SHOW POLICY', () => {
  it('blocks at the default threshold of 3 and allows 2', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    const customer = await Customer.create({
      businessId: business._id,
      name: 'Noa',
      phone: '0501234567',
    });
    await Customer.create({ businessId: business._id, name: 'Clear', phone: '0509999999' });
    await addNoShows(business._id, customer._id, service._id, 2);

    const allowed = await book(business._id.toString(), service._id.toString(), '0501234567', '10:00');
    expect(allowed.status).toBe(201);
    expect(allowed.body.customerId).toBe(customer._id.toString());

    const open = await request(app)
      .get(`/api/customers/${customer._id.toString()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(open.status).toBe(200);
    expect(open.body.blocked).toBe(false);

    await addNoShows(business._id, customer._id, service._id, 1);
    const blocked = await book(business._id.toString(), service._id.toString(), '050-123-4567', '11:00');
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('ONLINE_BOOKING_UNAVAILABLE');
    expect(blocked.body.message).toBe(ONLINE_BOOKING_UNAVAILABLE.he);

    const english = await book(business._id.toString(), service._id.toString(), '0501234567', '12:00', {
      language: 'en',
    });
    expect(english.status).toBe(403);
    expect(english.body.message).toBe(ONLINE_BOOKING_UNAVAILABLE.en);

    const list = await request(app)
      .get('/api/customers')
      .query({ page: 1, status: 'all', blocked: 'true' })
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items.length).toBe(1);
    expect(list.body.items[0]._id).toBe(customer._id.toString());
    expect(list.body.items[0].blocked).toBe(true);

    const detail = await request(app)
      .get(`/api/customers/${customer._id.toString()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.blocked).toBe(true);
  });

  it('does not block when the policy is disabled', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    const customer = await Customer.create({
      businessId: business._id,
      name: 'Noa',
      phone: '0501234567',
    });
    await addNoShows(business._id, customer._id, service._id, 3);
    await BusinessSettings.updateOne(
      { businessId: business._id },
      { $set: { noShowPolicy: { enabled: false, threshold: 3 } } }
    );

    const res = await book(business._id.toString(), service._id.toString(), '0501234567', '10:00');
    expect(res.status).toBe(201);

    const list = await request(app)
      .get('/api/customers')
      .query({ page: 1, status: 'all', blocked: 'true' })
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.total).toBe(0);
  });

  it('clears the block when no-shows are excused', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    const customer = await Customer.create({
      businessId: business._id,
      name: 'Noa',
      phone: '0501234567',
    });
    await addNoShows(business._id, customer._id, service._id, 3);
    const excused = await request(app)
      .post(`/api/customers/${customer._id.toString()}/no-shows/excuse-all`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(excused.status).toBe(200);
    expect(excused.body.noShowCount).toBe(0);

    const res = await book(business._id.toString(), service._id.toString(), '0501234567', '10:00');
    expect(res.status).toBe(201);
    const detail = await request(app)
      .get(`/api/customers/${customer._id.toString()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.blocked).toBe(false);
    const stored = await Appointment.find({ customerId: customer._id, status: 'no_show' });
    expect(stored.length).toBe(3);
  });

  it('reactivates an inactive customer who is not blocked', async () => {
    const { business } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    const customer = await Customer.create({
      businessId: business._id,
      name: 'Noa',
      phone: '0501234567',
      isActive: false,
    });

    const res = await book(business._id.toString(), service._id.toString(), '0501234567', '10:00');
    expect(res.status).toBe(201);
    const fresh = await Customer.findById(customer._id);
    expect(fresh?.isActive).toBe(true);
    const audit = await AuditLog.findOne({ action: 'customer.reactivated' });
    expect(audit?.actorEmail).toBe('system');
    expect(audit?.actorUserId == null).toBe(true);
    expect(audit?.entityId).toBe(customer._id.toString());
  });

  it('keeps a blocked inactive customer inactive', async () => {
    const { business } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    const customer = await Customer.create({
      businessId: business._id,
      name: 'Noa',
      phone: '0501234567',
      isActive: false,
    });
    await addNoShows(business._id, customer._id, service._id, 3);

    const res = await book(business._id.toString(), service._id.toString(), '0501234567', '10:00');
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(ONLINE_BOOKING_UNAVAILABLE.he);
    const fresh = await Customer.findById(customer._id);
    expect(fresh?.isActive).toBe(false);
    const audits = await AuditLog.find({ action: 'customer.reactivated' });
    expect(audits.length).toBe(0);
  });

  it('rejects a public phone that is not an Israeli mobile', async () => {
    const { business } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    const phones = ['12345', '02-1234567', '0721234567'];
    for (let i = 0; i < phones.length; i++) {
      const res = await book(
        business._id.toString(),
        service._id.toString(),
        phones[i],
        `1${i}:00`,
        { language: i === 1 ? 'en-US,en;q=0.9' : undefined }
      );
      expect(res.status).toBe(400);
      const expected = i === 1 ? PUBLIC_MOBILE_REQUIRED.en : PUBLIC_MOBILE_REQUIRED.he;
      expect(res.body.message).toBe(expected);
      expect(res.body.errors[0].path).toBe('customerPhone');
    }
    const count = await Customer.countDocuments({ businessId: business._id });
    expect(count).toBe(0);
  });

  it('matches a legacy raw-digits phone without rewriting it', async () => {
    const { business } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    const legacy = await Customer.create({
      businessId: business._id,
      name: 'Legacy',
      phone: '972501234567',
    });

    const res = await book(business._id.toString(), service._id.toString(), '0501234567', '10:00');
    expect(res.status).toBe(201);
    expect(res.body.customerId).toBe(legacy._id.toString());
    const count = await Customer.countDocuments({ businessId: business._id });
    expect(count).toBe(1);
    const fresh = await Customer.findById(legacy._id);
    expect(fresh?.phone).toBe('972501234567');
  });

  it('does not apply another business block to the same phone', async () => {
    const first = await seedOwner({ email: 'a@test.com' });
    const second = await seedOwner({ email: 'b@test.com' });
    await seedBusinessSettings(first.business._id);
    await seedBusinessSettings(second.business._id);
    const serviceA = await seedService(first.business._id);
    const serviceB = await seedService(second.business._id);
    const blocked = await Customer.create({
      businessId: first.business._id,
      name: 'Blocked elsewhere',
      phone: '0501234567',
    });
    const local = await Customer.create({
      businessId: second.business._id,
      name: 'Local',
      phone: '0501234567',
    });
    await addNoShows(first.business._id, blocked._id, serviceA._id, 3);

    const res = await book(second.business._id.toString(), serviceB._id.toString(), '0501234567', '10:00');
    expect(res.status).toBe(201);
    expect(res.body.customerId).toBe(local._id.toString());
  });

  it('lets only the owner read and change the policy, and audits a real change', async () => {
    const { business, token } = await seedOwner();
    const { token: staffToken } = await seedStaff(business._id);

    const staffGet = await request(app)
      .get('/api/customers/no-show-policy')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(staffGet.status).toBe(403);
    const staffPut = await request(app)
      .put('/api/customers/no-show-policy')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ enabled: false, threshold: 5 });
    expect(staffPut.status).toBe(403);

    const initial = await request(app)
      .get('/api/customers/no-show-policy')
      .set('Authorization', `Bearer ${token}`);
    expect(initial.status).toBe(200);
    expect(initial.body.enabled).toBe(true);
    expect(initial.body.threshold).toBe(3);

    const tooHigh = await request(app)
      .put('/api/customers/no-show-policy')
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: true, threshold: 21 });
    expect(tooHigh.status).toBe(400);

    const saved = await request(app)
      .put('/api/customers/no-show-policy')
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: false, threshold: 5 });
    expect(saved.status).toBe(200);
    expect(saved.body.enabled).toBe(false);
    expect(saved.body.threshold).toBe(5);

    const again = await request(app)
      .put('/api/customers/no-show-policy')
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: false, threshold: 5 });
    expect(again.status).toBe(200);
    const audits = await AuditLog.find({ action: 'customer.no_show_policy_updated' });
    expect(audits.length).toBe(1);
    expect(audits[0].actorEmail).toBe('owner@test.com');
    expect(audits[0].entity).toBe('BusinessSettings');
  });

  it('blocks the legacy public create route and a logged-in public session', async () => {
    const { business } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    const customer = await Customer.create({
      businessId: business._id,
      name: 'Noa',
      phone: '0501234567',
    });
    await addNoShows(business._id, customer._id, service._id, 3);

    const clientToken = signTestToken({
      userId: 'client',
      role: 'client',
      businessId: business._id.toString(),
      customerId: customer._id.toString(),
    });
    const start = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const legacy = await request(app)
      .post(`/api/public/${business.slug}/appointments`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        serviceId: service._id.toString(),
        customerId: customer._id.toString(),
        start: start.toISOString(),
        end: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
      });
    expect(legacy.status).toBe(403);
    expect(legacy.body.code).toBe('ONLINE_BOOKING_UNAVAILABLE');
    expect(legacy.body.message).toBe(ONLINE_BOOKING_UNAVAILABLE.he);

    const first = await book(business._id.toString(), service._id.toString(), '0508888888', '10:00', {
      name: 'Session Guest',
    });
    expect(first.status).toBe(201);
    const sessionCustomer = await Customer.findById(first.body.customerId);
    await addNoShows(business._id, sessionCustomer?._id, service._id, 3);
    const second = await book(business._id.toString(), service._id.toString(), '', '11:00', {
      token: first.body.token,
    });
    expect(second.status).toBe(403);
    expect(second.body.message).toBe(ONLINE_BOOKING_UNAVAILABLE.he);
  });
});
