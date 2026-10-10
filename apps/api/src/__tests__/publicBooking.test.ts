import request from 'supertest';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedService, seedBusinessSettings, seedCustomer } from './helpers/seed';
import { Appointment } from '../models/Appointment';
import { OtpChallenge } from '../models/OtpChallenge';
import { Customer } from '../models/Customer';
import { BusinessSettings } from '../models/BusinessSettings';
import { AuditLog } from '../models/AuditLog';
import { PublicClientSession } from '../models/PublicClientSession';
import { Service } from '../models/Service';
import { loginPublicClient } from './helpers/publicSession';

const app = buildTestApp();

async function verifiedSession(slug: string, phone: string): Promise<{ cookie: string; sessionId: string }> {
  return loginPublicClient(app, slug, phone);
}

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

describe('PUBLIC BOOKING', () => {
  it('guest can fetch business info by slug (no auth)', async () => {
    const { business } = await seedOwner();
    await seedService(business._id);
    await seedBusinessSettings(business._id);

    const res = await request(app).get(`/api/public/businesses/${business.slug}`);

    expect(res.status).toBe(200);
    expect(res.body.slug).toBe(business.slug);
  });

  it('returns 404 for unknown business slug', async () => {
    const res = await request(app).get('/api/public/businesses/no-such-slug');

    expect([404, 403]).toContain(res.status);
  });

  it('guest can list services for a business', async () => {
    const { business } = await seedOwner();
    await seedService(business._id);
    await seedBusinessSettings(business._id);

    const res = await request(app).get(`/api/public/businesses/${business.slug}/services`);

    expect(res.status).toBe(200);
    const services: unknown[] = Array.isArray(res.body) ? res.body : res.body.services ?? [];
    expect(services.length).toBeGreaterThan(0);
  });

  it('shows a newly created active service on the public list and hides it after deactivation', async () => {
    const { business, token } = await seedOwner();
    const older = await seedService(business._id);
    await seedBusinessSettings(business._id);
    await BusinessSettings.updateOne(
      { businessId: business._id },
      { $set: { landingServiceOrder: [older._id.toString()] } }
    );

    const created = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Cut', durationMinutes: 30, price: 80 });
    expect(created.status).toBe(201);
    const createdId = String(created.body._id);

    const listed = await request(app).get(`/api/public/businesses/${business.slug}/services`);
    expect(listed.status).toBe(200);
    const ids = (listed.body as { id: string }[]).map((row) => row.id);
    expect(ids[0]).toBe(createdId);
    expect(ids.includes(older._id.toString())).toBe(true);

    const hidden = await request(app)
      .put(`/api/services/${createdId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    expect(hidden.status).toBe(200);

    const after = await request(app).get(`/api/public/businesses/${business.slug}/services`);
    const afterIds = (after.body as { id: string }[]).map((row) => row.id);
    expect(afterIds.includes(createdId)).toBe(false);
    expect(afterIds.includes(older._id.toString())).toBe(true);
    const stored = await Service.findById(createdId);
    expect(stored?.isActive).toBe(false);
  });

  it('unauthenticated request to /api/customers returns 401', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(401);
  });

  it('unauthenticated request to /api/appointments returns 401', async () => {
    const res = await request(app).get('/api/appointments');
    expect(res.status).toBe(401);
  });

  it('unauthenticated request to /api/services returns 401', async () => {
    const res = await request(app).get('/api/services');
    expect(res.status).toBe(401);
  });

  it('rejects a create request that has no session cookie', async () => {
    const { business } = await seedOwner();
    const service = await seedService(business._id);
    await seedBusinessSettings(business._id);
    await Customer.create({ businessId: business._id, name: 'Dana Cohen', phone: '0501234567' });
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const date = tomorrow.toISOString().slice(0, 10);

    const res = await request(app).post('/api/public/appointments').send({
      businessId: business._id.toString(),
      serviceId: service._id.toString(),
      date,
      time: '10:00',
      customerName: 'Dana',
      customerPhone: '0501234567',
    });

    expect(res.status).toBe(401);
    expect(await Appointment.countDocuments({ businessId: business._id })).toBe(0);
  });

  it('a verified session can book and list upcoming without a new session cookie', async () => {
    const { business } = await seedOwner();
    const service = await seedService(business._id);
    await seedBusinessSettings(business._id);
    await Customer.create({ businessId: business._id, name: 'Dana Cohen', phone: '0501234567' });
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const date = tomorrow.toISOString().slice(0, 10);
    const session = await verifiedSession(business.slug, '0501234567');

    const created = await request(app)
      .post('/api/public/appointments')
      .set('Cookie', session.cookie)
      .send({
        businessId: business._id.toString(),
        serviceId: service._id.toString(),
        date,
        time: '10:00',
      });

    expect(created.status).toBe(201);
    expect(created.body.token).toBeUndefined();
    expect(created.body.sessionId).toBeUndefined();
    expect(created.body.customerId).toBeTruthy();
    const refreshed = created.headers['set-cookie'];
    const refreshedCookie = Array.isArray(refreshed) ? refreshed.join(';') : String(refreshed ?? '');
    expect(refreshedCookie.includes(session.sessionId)).toBe(true);

    const upcoming = await request(app)
      .get('/api/public/appointments/upcoming')
      .set('Cookie', session.cookie);

    expect(upcoming.status).toBe(200);
    expect(upcoming.body.appointment).not.toBeNull();
    expect(upcoming.body.appointment.id).toBe(created.body.id);
    expect(Array.isArray(upcoming.body.appointments)).toBe(true);
    expect(upcoming.body.appointments.length).toBe(1);
    expect(upcoming.body.appointments[0].id).toBe(created.body.id);
    expect(upcoming.body.appointments[0].serviceId).toBe(service._id.toString());
  });

  it('returns all upcoming appointments sorted soonest-first and isolates by customer', async () => {
    const { business } = await seedOwner();
    const service = await seedService(business._id);
    await seedBusinessSettings(business._id);
    const later = new Date();
    later.setUTCDate(later.getUTCDate() + 2);
    const sooner = new Date();
    sooner.setUTCDate(sooner.getUTCDate() + 1);
    const laterDate = later.toISOString().slice(0, 10);
    const soonerDate = sooner.toISOString().slice(0, 10);

    await Customer.create({ businessId: business._id, name: 'Dana Cohen', phone: '0501234567' });
    const session = await verifiedSession(business.slug, '0501234567');
    const laterBooking = await request(app)
      .post('/api/public/appointments')
      .set('Cookie', session.cookie)
      .send({
        businessId: business._id.toString(),
        serviceId: service._id.toString(),
        date: laterDate,
        time: '14:00',
      });
    expect(laterBooking.status).toBe(201);
    const customerId = laterBooking.body.customerId as string;

    const soonerBooking = await request(app)
      .post('/api/public/appointments')
      .set('Cookie', session.cookie)
      .send({
        businessId: business._id.toString(),
        serviceId: service._id.toString(),
        date: soonerDate,
        time: '09:00',
      });
    expect(soonerBooking.status).toBe(201);

    const otherCustomer = await seedCustomer(business._id);
    await Appointment.create({
      businessId: business._id,
      customerId: otherCustomer._id,
      serviceId: service._id,
      start: new Date(sooner.getTime() + 3 * 60 * 60 * 1000),
      end: new Date(sooner.getTime() + 4 * 60 * 60 * 1000),
      status: 'confirmed',
      source: 'owner',
    });

    await Appointment.create({
      businessId: business._id,
      customerId: customerId,
      serviceId: service._id,
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date(Date.now() - 23 * 60 * 60 * 1000),
      status: 'confirmed',
      source: 'client-online',
    });

    await Appointment.create({
      businessId: business._id,
      customerId: customerId,
      serviceId: service._id,
      start: new Date(sooner.getTime() + 6 * 60 * 60 * 1000),
      end: new Date(sooner.getTime() + 7 * 60 * 60 * 1000),
      status: 'cancelled',
      source: 'client-online',
      cancellationReason: 'test',
    });

    const upcoming = await request(app)
      .get('/api/public/appointments/upcoming')
      .set('Cookie', session.cookie);

    expect(upcoming.status).toBe(200);
    const ids = (upcoming.body.appointments as { id: string }[]).map((a) => a.id);
    expect(ids).toEqual([soonerBooking.body.id, laterBooking.body.id]);
    expect(upcoming.body.appointment.id).toBe(soonerBooking.body.id);

    const guest = await request(app).get('/api/public/appointments/upcoming');
    expect(guest.status).toBe(200);
    expect(guest.body.appointment).toBeNull();
    expect(guest.body.appointments).toEqual([]);
  });

  it('lets a customer cancel only pending or confirmed appointments', async () => {
    const { business } = await seedOwner();
    const service = await seedService(business._id);
    await seedBusinessSettings(business._id);
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const date = tomorrow.toISOString().slice(0, 10);

    await BusinessSettings.updateOne({ businessId: business._id }, { $set: { cancellationWindowHours: 0 } });
    await Customer.create({ businessId: business._id, name: 'Dana Cohen', phone: '0501234567' });
    const session = await verifiedSession(business.slug, '0501234567');
    const created = await request(app)
      .post('/api/public/appointments')
      .set('Cookie', session.cookie)
      .send({
        businessId: business._id.toString(),
        serviceId: service._id.toString(),
        date,
        time: '10:00',
      });
    expect(created.status).toBe(201);
    const customerId = created.body.customerId as string;
    const confirmedId = created.body.id as string;

    const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const base = {
      businessId: business._id,
      customerId,
      serviceId: service._id,
      start,
      end,
      source: 'client-online' as const,
    };
    const pending = await Appointment.create({ ...base, status: 'pending' });
    const noShow = await Appointment.create({ ...base, status: 'no_show' });
    const completed = await Appointment.create({ ...base, status: 'completed' });
    const alreadyCancelled = await Appointment.create({
      ...base,
      status: 'cancelled',
      cancellationReason: 'earlier',
    });

    const cancel = (id: string) =>
      request(app)
        .delete(`/api/public/appointments/${id}`)
        .set('Cookie', session.cookie)
        .send({ cancellationReason: 'Cannot make it' });

    const confirmedRes = await cancel(confirmedId);
    expect(confirmedRes.status).toBe(200);
    expect((await Appointment.findById(confirmedId))?.status).toBe('cancelled');

    const pendingRes = await cancel(pending._id.toString());
    expect(pendingRes.status).toBe(200);
    expect((await Appointment.findById(pending._id))?.status).toBe('cancelled');

    const blocked = [noShow, completed, alreadyCancelled];
    for (const row of blocked) {
      const res = await cancel(row._id.toString());
      expect(res.status).toBe(409);
      expect((await Appointment.findById(row._id))?.status).toBe(row.status);
    }
  });

  it('stores a canonical phone on identify and rejects a non-mobile', async () => {
    const { business } = await seedOwner();
    const service = await seedService(business._id);
    await seedBusinessSettings(business._id);
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const date = tomorrow.toISOString().slice(0, 10);

    const anonymous = await request(app).post('/api/public/appointments').send({
      businessId: business._id.toString(),
      serviceId: service._id.toString(),
      date,
      time: '10:00',
    });
    expect(anonymous.status).toBe(401);

    const start = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/start`)
      .send({ phone: '050-123-4567' });
    expect(start.status).toBe(200);
    expect(start.body.status).toBe('code_sent');
    const challenge = await OtpChallenge.findOne({ businessSlug: business.slug, phone: '0501234567' });
    expect(challenge?.phone).toBe('0501234567');

    const rejected = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/start`)
      .send({ phone: '12345' });
    expect(rejected.status).toBe(400);
    expect(rejected.body.message).toBe('Enter an Israeli mobile (05 and 8 digits)');
    expect(await Customer.countDocuments({ businessId: business._id })).toBe(0);
  });

  it('cancels inside the window and refuses outside it', async () => {
    const { business } = await seedOwner();
    const service = await seedService(business._id);
    await seedBusinessSettings(business._id);
    await Customer.create({ businessId: business._id, name: 'Dana Cohen', phone: '0501234567' });
    const session = await verifiedSession(business.slug, '0501234567');
    const customer = await Customer.findOne({ businessId: business._id, phone: '0501234567' });
    const insideStart = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const outsideStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const inside = await Appointment.create({
      businessId: business._id,
      customerId: customer!._id,
      serviceId: service._id,
      start: insideStart,
      end: new Date(insideStart.getTime() + 60 * 60 * 1000),
      status: 'confirmed',
      source: 'client-online',
    });
    const outside = await Appointment.create({
      businessId: business._id,
      customerId: customer!._id,
      serviceId: service._id,
      start: outsideStart,
      end: new Date(outsideStart.getTime() + 60 * 60 * 1000),
      status: 'confirmed',
      source: 'client-online',
    });

    const blocked = await request(app)
      .delete(`/api/public/appointments/${outside._id.toString()}`)
      .set('Cookie', session.cookie)
      .send({ cancellationReason: 'too soon' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('OUTSIDE_CANCELLATION_WINDOW');
    expect((await Appointment.findById(outside._id))?.status).toBe('confirmed');

    const ok = await request(app)
      .delete(`/api/public/appointments/${inside._id.toString()}`)
      .set('Cookie', session.cookie)
      .send({ cancellationReason: 'plans changed' });
    expect(ok.status).toBe(200);
    expect((await Appointment.findById(inside._id))?.status).toBe('cancelled');
    const audit = await AuditLog.findOne({
      action: 'appointment.cancelled_by_customer',
      entityId: inside._id.toString(),
    });
    expect(audit?.metadata?.actor).toBe('customer');
    expect(audit?.actorEmail).toBe('0501234567');
  });

  it('reschedules by creating the new visit before cancelling the old one', async () => {
    const { business } = await seedOwner();
    const service = await seedService(business._id);
    await seedBusinessSettings(business._id);
    await Customer.create({ businessId: business._id, name: 'Dana Cohen', phone: '0501234567' });
    const session = await verifiedSession(business.slug, '0501234567');
    const customer = await Customer.findOne({ businessId: business._id, phone: '0501234567' });
    const start = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    start.setUTCHours(10, 0, 0, 0);
    const original = await Appointment.create({
      businessId: business._id,
      customerId: customer!._id,
      serviceId: service._id,
      start,
      end: new Date(start.getTime() + 60 * 60 * 1000),
      status: 'confirmed',
      source: 'client-online',
    });
    const blockerStart = new Date(start.getTime());
    blockerStart.setUTCHours(15, 0, 0, 0);
    await Appointment.create({
      businessId: business._id,
      customerId: customer!._id,
      serviceId: service._id,
      start: blockerStart,
      end: new Date(blockerStart.getTime() + 60 * 60 * 1000),
      status: 'confirmed',
      source: 'owner',
    });

    const date = start.toISOString().slice(0, 10);
    const failed = await request(app)
      .post(`/api/public/appointments/${original._id.toString()}/reschedule`)
      .set('Cookie', session.cookie)
      .send({ date, time: '15:00' });
    expect(failed.status).toBe(409);
    const kept = await Appointment.findById(original._id);
    expect(kept?.status).toBe('confirmed');
    expect(kept?.rescheduledTo).toBeUndefined();
    expect(await Appointment.countDocuments({ customerId: customer!._id, status: 'confirmed' })).toBe(2);

    const moved = await request(app)
      .post(`/api/public/appointments/${original._id.toString()}/reschedule`)
      .set('Cookie', session.cookie)
      .send({ date, time: '18:00' });
    expect(moved.status).toBe(201);
    const originalAfter = await Appointment.findById(original._id);
    expect(originalAfter?.status).toBe('cancelled');
    expect(originalAfter?.cancellationReason).toBe('rescheduled');
    expect(originalAfter?.rescheduledTo?.toString()).toBe(moved.body.id);
    const created = await Appointment.findById(moved.body.id);
    expect(created?.status).toBe('confirmed');
    expect(created?.customerId?.toString()).toBe(customer!._id.toString());
    expect(created?.rescheduledFrom?.toString()).toBe(original._id.toString());
    expect(await Appointment.countDocuments({ customerId: customer!._id, status: 'confirmed' })).toBe(2);
    const audits = await AuditLog.find({ action: 'appointment.rescheduled_by_customer' });
    expect(audits.length).toBe(2);
    expect(audits.every((row) => row.metadata?.actor === 'customer' && row.actorEmail === '0501234567')).toBe(true);
    const ids = audits.map((row) => row.entityId).sort();
    expect(ids).toEqual([original._id.toString(), moved.body.id].sort());
  });

  it('allows a move that overlaps the original visit and rejects one outside the window', async () => {
    const { business } = await seedOwner();
    const service = await seedService(business._id);
    await seedBusinessSettings(business._id);
    await Customer.create({ businessId: business._id, name: 'Dana Cohen', phone: '0501234567' });
    const session = await verifiedSession(business.slug, '0501234567');
    const customer = await Customer.findOne({ businessId: business._id, phone: '0501234567' });
    const start = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    start.setUTCHours(10, 0, 0, 0);
    const original = await Appointment.create({
      businessId: business._id,
      customerId: customer!._id,
      serviceId: service._id,
      start,
      end: new Date(start.getTime() + 60 * 60 * 1000),
      status: 'confirmed',
      source: 'client-online',
    });
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const outside = await Appointment.create({
      businessId: business._id,
      customerId: customer!._id,
      serviceId: service._id,
      start: soon,
      end: new Date(soon.getTime() + 60 * 60 * 1000),
      status: 'confirmed',
      source: 'client-online',
    });

    const shifted = await request(app)
      .post(`/api/public/appointments/${original._id.toString()}/reschedule`)
      .set('Cookie', session.cookie)
      .send({ date: start.toISOString().slice(0, 10), time: '10:30' });
    expect(shifted.status).toBe(201);
    expect((await Appointment.findById(original._id))?.status).toBe('cancelled');
    expect((await Appointment.findById(shifted.body.id))?.status).toBe('confirmed');

    const blocked = await request(app)
      .post(`/api/public/appointments/${outside._id.toString()}/reschedule`)
      .set('Cookie', session.cookie)
      .send({ date: soon.toISOString().slice(0, 10), time: '18:00' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('OUTSIDE_CANCELLATION_WINDOW');
    expect((await Appointment.findById(outside._id))?.status).toBe('confirmed');
  });

  it('refuses to reschedule someone else\'s appointment', async () => {
    const { business } = await seedOwner();
    const service = await seedService(business._id);
    await seedBusinessSettings(business._id);
    await Customer.create({ businessId: business._id, name: 'Dana Cohen', phone: '0501234567' });
    await Customer.create({ businessId: business._id, name: 'Other Client', phone: '0507654321' });
    const ownerSession = await verifiedSession(business.slug, '0501234567');
    const otherSession = await verifiedSession(business.slug, '0507654321');
    const customer = await Customer.findOne({ businessId: business._id, phone: '0501234567' });
    const start = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    start.setUTCHours(10, 0, 0, 0);
    const original = await Appointment.create({
      businessId: business._id,
      customerId: customer!._id,
      serviceId: service._id,
      start,
      end: new Date(start.getTime() + 60 * 60 * 1000),
      status: 'confirmed',
      source: 'client-online',
    });
    expect(ownerSession.sessionId).not.toBe(otherSession.sessionId);
    const moved = await request(app)
      .post(`/api/public/appointments/${original._id.toString()}/reschedule`)
      .set('Cookie', otherSession.cookie)
      .send({ date: start.toISOString().slice(0, 10), time: '12:00' });
    expect(moved.status).toBe(404);
    expect((await Appointment.findById(original._id))?.status).toBe('confirmed');
    expect(await Appointment.countDocuments({ customerId: customer!._id })).toBe(1);
  });

  it('refuses cancel and reschedule for an unverified session', async () => {
    const { business } = await seedOwner();
    const service = await seedService(business._id);
    await seedBusinessSettings(business._id);
    await Customer.create({ businessId: business._id, name: 'Dana Cohen', phone: '0501234567' });
    const session = await verifiedSession(business.slug, '0501234567');
    await PublicClientSession.updateOne(
      { sessionId: session.sessionId },
      { $set: { 'bindings.0.verified': false } }
    );
    const customer = await Customer.findOne({ businessId: business._id, phone: '0501234567' });
    const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const apt = await Appointment.create({
      businessId: business._id,
      customerId: customer!._id,
      serviceId: service._id,
      start,
      end: new Date(start.getTime() + 60 * 60 * 1000),
      status: 'confirmed',
      source: 'client-online',
    });
    const date = start.toISOString().slice(0, 10);
    const cancel = await request(app)
      .delete(`/api/public/appointments/${apt._id.toString()}`)
      .set('Cookie', session.cookie)
      .send({ cancellationReason: 'no' });
    expect(cancel.status).toBe(401);
    const moved = await request(app)
      .post(`/api/public/appointments/${apt._id.toString()}/reschedule`)
      .set('Cookie', session.cookie)
      .send({ date, time: '16:00' });
    expect(moved.status).toBe(401);
    expect((await Appointment.findById(apt._id))?.status).toBe('confirmed');
  });
});
