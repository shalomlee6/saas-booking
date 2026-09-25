import request from 'supertest';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedService, seedBusinessSettings, seedCustomer } from './helpers/seed';
import { OtpChallenge } from '../models/OtpChallenge';
import { Appointment } from '../models/Appointment';

const app = buildTestApp();

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

  it('rejects guest booking without a phone number', async () => {
    const { business } = await seedOwner();
    const service = await seedService(business._id);
    await seedBusinessSettings(business._id);
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const date = tomorrow.toISOString().slice(0, 10);

    const res = await request(app).post('/api/public/appointments').send({
      businessId: business._id.toString(),
      serviceId: service._id.toString(),
      date,
      time: '10:00',
      customerName: 'Dana',
    });

    expect(res.status).toBe(400);
  });

  it('guest booking creates a customer session and upcoming appointment', async () => {
    const { business } = await seedOwner();
    const service = await seedService(business._id);
    await seedBusinessSettings(business._id);
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const date = tomorrow.toISOString().slice(0, 10);

    const created = await request(app).post('/api/public/appointments').send({
      businessId: business._id.toString(),
      serviceId: service._id.toString(),
      date,
      time: '10:00',
      customerName: 'Dana Cohen',
      customerPhone: '0501234567',
    });

    expect(created.status).toBe(201);
    expect(created.body.token).toBeTruthy();
    expect(created.body.customerId).toBeTruthy();

    const upcoming = await request(app)
      .get('/api/public/appointments/upcoming')
      .set('Authorization', `Bearer ${created.body.token}`);

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

    const laterBooking = await request(app).post('/api/public/appointments').send({
      businessId: business._id.toString(),
      serviceId: service._id.toString(),
      date: laterDate,
      time: '14:00',
      customerName: 'Dana Cohen',
      customerPhone: '0501234567',
    });
    expect(laterBooking.status).toBe(201);
    const token = laterBooking.body.token as string;
    const customerId = laterBooking.body.customerId as string;

    const soonerBooking = await request(app)
      .post('/api/public/appointments')
      .set('Authorization', `Bearer ${token}`)
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
      .set('Authorization', `Bearer ${token}`);

    expect(upcoming.status).toBe(200);
    const ids = (upcoming.body.appointments as { id: string }[]).map((a) => a.id);
    expect(ids).toEqual([soonerBooking.body.id, laterBooking.body.id]);
    expect(upcoming.body.appointment.id).toBe(soonerBooking.body.id);

    const guest = await request(app).get('/api/public/appointments/upcoming');
    expect(guest.status).toBe(200);
    expect(guest.body.appointment).toBeNull();
    expect(guest.body.appointments).toEqual([]);
  });

  it('request-otp stores a code and verify-otp issues a customer session', async () => {
    const { business } = await seedOwner();
    const reqOtp = await request(app)
      .post(`/api/public/${business.slug}/auth/request-otp`)
      .send({ phone: '0501234567', firstName: 'Dana', lastName: 'Cohen' });

    expect(reqOtp.status).toBe(200);
    expect(reqOtp.body.ok).toBe(true);

    const stored = await OtpChallenge.findOne({
      businessSlug: business.slug,
      phone: '0501234567',
    });
    expect(stored?.code).toBeTruthy();

    const verify = await request(app)
      .post(`/api/public/${business.slug}/auth/verify-otp`)
      .send({ phone: '0501234567', code: stored!.code });

    expect(verify.status).toBe(200);
    expect(verify.body.token).toBeTruthy();
    expect(verify.body.customerId).toBeTruthy();
  });
});
