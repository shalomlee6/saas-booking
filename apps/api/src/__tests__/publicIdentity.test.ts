import request from 'supertest';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedService, seedBusinessSettings, signTestToken } from './helpers/seed';
import { OtpChallenge } from '../models/OtpChallenge';
import { Customer } from '../models/Customer';
import { Appointment } from '../models/Appointment';
import { PublicClientSession } from '../models/PublicClientSession';
import { BusinessSettings } from '../models/BusinessSettings';
import { CustomerServiceConfig } from '../models/CustomerServiceConfig';
import { AuditLog } from '../models/AuditLog';
import { User } from '../models/User';
import bcrypt from 'bcryptjs';
import { LogSmsProvider, TextMeSmsProvider, installSmsProvider, getSmsProvider } from '../services/smsProvider';
import { publicRouter } from '../routes/public';
import { otpIpRouteLimiter, otpRouteLimiter } from '../middleware/rateLimits';
import type { Request, Response } from 'express';

const app = buildTestApp();

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => {
  delete process.env.IDENTITY_MODE;
  await dbClear();
});
afterEach(() => {
  delete process.env.IDENTITY_MODE;
  installSmsProvider(process.env.NODE_ENV ?? 'test');
});

function tomorrowKey(): string {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

function sessionCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const lines = Array.isArray(raw) ? raw.map(String) : [];
  const found = lines.find((line) => line.startsWith('sb_public_customer='));
  if (!found) throw new Error('missing session cookie');
  return found.split(';')[0];
}

function sessionIdFromCookie(cookie: string): string {
  return cookie.slice(cookie.indexOf('=') + 1);
}

async function otpCode(slug: string, phone: string): Promise<string> {
  const stored = await OtpChallenge.findOne({ businessSlug: slug, phone });
  return stored?.code ?? '';
}

describe('PUBLIC CLIENT IDENTITY', () => {
  it('otp mode sends a code and does not return the customer name', async () => {
    const { business } = await seedOwner();
    await Customer.create({ businessId: business._id, name: 'Noa Levi', firstName: 'Noa', phone: '0501111111' });
    const start = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/start`)
      .send({ phone: '050-111-1111' });
    expect(start.status).toBe(200);
    expect(start.body.status).toBe('code_sent');
    expect(start.body.sessionId).toBeUndefined();
    expect(start.body.firstName).toBeUndefined();
    expect(start.body.name).toBeUndefined();
    const stored = await OtpChallenge.findOne({ businessSlug: business.slug, phone: '0501111111' });
    expect(stored?.code).toMatch(/^\d{6}$/);
    expect((await PublicClientSession.countDocuments({}))).toBe(0);
  });

  it('phone mode opens an unverified session and sends no SMS', async () => {
    process.env.IDENTITY_MODE = 'phone';
    const { business } = await seedOwner();
    await Customer.create({ businessId: business._id, name: 'Noa Levi', firstName: 'Noa', phone: '0501111111' });
    const start = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/start`)
      .send({ phone: '0501111111' });
    expect(start.status).toBe(200);
    expect(start.body.status).toBe('known');
    expect(start.body.sessionId).toBeUndefined();
    expect(start.body.firstName).toBeUndefined();
    expect(start.body.name).toBeUndefined();
    expect((await OtpChallenge.countDocuments({}))).toBe(0);
    const row = await PublicClientSession.findOne({ sessionId: sessionIdFromCookie(sessionCookie(start)) });
    expect(row?.bindings[0]?.verified).toBe(false);

    const verify = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/verify`)
      .send({ phone: '0501111111', code: '000000' });
    expect(verify.status).toBe(404);
  });

  it('returns blocked and does not send an SMS', async () => {
    const { business } = await seedOwner();
    await Customer.create({
      businessId: business._id,
      name: 'Blocked',
      phone: '0502222222',
      bookingOverride: 'block',
    });
    const start = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/start`)
      .send({ phone: '0502222222' });
    expect(start.status).toBe(200);
    expect(start.body.status).toBe('blocked');
    expect(start.body.sessionId).toBeUndefined();
    expect((await OtpChallenge.countDocuments({}))).toBe(0);
    expect((await PublicClientSession.countDocuments({}))).toBe(0);
  });

  it('kills a code after five wrong attempts', async () => {
    const { business } = await seedOwner();
    const phone = '0503333333';
    const start = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/start`)
      .send({ phone });
    expect(start.status).toBe(200);
    const code = await otpCode(business.slug, phone);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      const attempt = await request(app)
        .post(`/api/public/businesses/${business.slug}/identify/verify`)
        .send({ phone, code: wrong });
      expect(attempt.status).toBe(400);
    }
    const correct = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/verify`)
      .send({ phone, code });
    expect(correct.status).toBe(400);
    expect((await PublicClientSession.countDocuments({}))).toBe(0);
  });

  it('rejects an expired code', async () => {
    const { business } = await seedOwner();
    const phone = '0503333334';
    await request(app).post(`/api/public/businesses/${business.slug}/identify/start`).send({ phone });
    const code = await otpCode(business.slug, phone);
    await OtpChallenge.updateOne(
      { businessSlug: business.slug, phone },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );
    const verify = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/verify`)
      .send({ phone, code });
    expect(verify.status).toBe(400);
  });

  it('allows another code only after the resend wait', async () => {
    const { business } = await seedOwner();
    const phone = '0503333335';
    const first = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/start`)
      .send({ phone });
    expect(first.status).toBe(200);
    const early = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/start`)
      .send({ phone });
    expect(early.status).toBe(429);
    const firstCode = await otpCode(business.slug, phone);
    await OtpChallenge.updateOne(
      { businessSlug: business.slug, phone },
      { $set: { lastSentAt: new Date(Date.now() - 31_000) } }
    );
    const again = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/start`)
      .send({ phone });
    expect(again.status).toBe(200);
    const secondCode = await otpCode(business.slug, phone);
    expect(secondCode).not.toBe(firstCode);
  });

  it('identify/start in otp mode in development calls the provider', async () => {
    process.env.IDENTITY_MODE = 'otp';
    const provider = installSmsProvider('development');
    const calls: string[] = [];
    const originalSend = provider.send.bind(provider);
    provider.send = async (phone: string, text: string) => {
      calls.push(`${phone}|${text}`);
      await originalSend(phone, text);
    };
    const warnings: string[] = [];
    const previousWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map((part) => String(part)).join(' '));
    };
    const phone = '0505555555';
    try {
      const { business } = await seedOwner();
      const start = await request(app)
        .post(`/api/public/businesses/${business.slug}/identify/start`)
        .send({ phone });
      expect(start.status).toBe(200);
      const code = await otpCode(business.slug, phone);
      expect(provider instanceof LogSmsProvider).toBe(true);
      expect(calls.length).toBe(1);
      expect(calls[0]).toBe(`${phone}|קוד האימות שלך: ${code}`);
      expect(warnings.includes(`[DEV OTP] ${phone} → ${code}`)).toBe(true);
    } finally {
      console.warn = previousWarn;
    }
  });

  it('refuses the log SMS provider in production and leaves TextMe unconfigured', async () => {
    let refused = false;
    try {
      new LogSmsProvider('production');
    } catch (error) {
      refused = error instanceof Error && error.message === 'LogSmsProvider cannot run when NODE_ENV=production';
    }
    expect(refused).toBe(true);

    installSmsProvider('production');
    let notConfigured = false;
    try {
      await getSmsProvider().send('0501111111', 'code');
    } catch (error) {
      notConfigured = error instanceof Error && error.message === 'not configured';
    }
    expect(notConfigured).toBe(true);
    expect(new TextMeSmsProvider()).toBeTruthy();
  });

  it('renews a session on use and logout revokes it', async () => {
    const { business } = await seedOwner();
    const phone = '0504444444';
    await request(app).post(`/api/public/businesses/${business.slug}/identify/start`).send({ phone });
    const verify = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/verify`)
      .send({ phone, code: await otpCode(business.slug, phone) });
    expect(verify.status).toBe(200);
    expect(verify.body.sessionId).toBeUndefined();
    expect(verify.body.status).toBe('new');
    const cookie = sessionCookie(verify);
    const sessionId = sessionIdFromCookie(cookie);
    await PublicClientSession.updateOne(
      { sessionId },
      { $set: { expiresAt: new Date(Date.now() + 60_000) } }
    );
    const me = await request(app).get('/api/public/session/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    const renewed = await PublicClientSession.findOne({ sessionId });
    expect((renewed?.expiresAt.getTime() ?? 0) > Date.now() + 300 * 24 * 60 * 60 * 1000).toBe(true);

    const logout = await request(app).post('/api/public/session/logout').set('Cookie', cookie);
    expect(logout.status).toBe(200);
    const after = await request(app).get('/api/public/session/me').set('Cookie', cookie);
    expect(after.status).toBe(401);
    const revoked = await PublicClientSession.findOne({ sessionId });
    expect(revoked?.revokedAt).toBeTruthy();
  });

  it('hides the name and appointments from an unverified session', async () => {
    process.env.IDENTITY_MODE = 'phone';
    const { business } = await seedOwner();
    await Customer.create({ businessId: business._id, name: 'Noa Levi', firstName: 'Noa', phone: '0505555555' });
    const start = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/start`)
      .send({ phone: '0505555555' });
    const cookie = sessionCookie(start);
    const me = await request(app).get('/api/public/session/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.verified).toBe(false);
    expect(me.body.firstName).toBeUndefined();
    expect(me.body.hasVisibleAppointments).toBe(false);
    const upcoming = await request(app)
      .get('/api/public/appointments/upcoming')
      .set('Cookie', cookie);
    expect(upcoming.status).toBe(200);
    expect(upcoming.body.appointment).toBeNull();
    expect(upcoming.body.appointments.length).toBe(0);
  });

  it('shows a phone-mode booking only to the session that created it', async () => {
    process.env.IDENTITY_MODE = 'phone';
    const { business } = await seedOwner();
    const service = await seedService(business._id);
    await seedBusinessSettings(business._id);
    const customer = await Customer.create({
      businessId: business._id,
      name: 'Noa Levi',
      firstName: 'Noa',
      phone: '0505555555',
    });
    const otherStart = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    otherStart.setUTCHours(9, 0, 0, 0);
    const otherApt = await Appointment.create({
      businessId: business._id,
      customerId: customer._id,
      serviceId: service._id,
      start: otherStart,
      end: new Date(otherStart.getTime() + 60 * 60 * 1000),
      status: 'confirmed',
      source: 'client-online',
    });

    const start = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/start`)
      .send({ phone: '0505555555' });
    const cookie = sessionCookie(start);
    const sessionId = sessionIdFromCookie(cookie);
    const when = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    when.setUTCHours(10, 0, 0, 0);
    const date = when.toISOString().slice(0, 10);
    const booked = await request(app)
      .post('/api/public/appointments')
      .set('Cookie', cookie)
      .send({
        slug: business.slug,
        serviceId: service._id.toString(),
        date,
        time: '10:00',
      });
    expect(booked.status).toBe(201);
    const stored = await Appointment.findById(booked.body.id);
    expect(stored?.createdBySessionId).toBe(decodeURIComponent(sessionId));
    const steal = await request(app)
      .delete(`/api/public/appointments/${otherApt._id.toString()}`)
      .set('Cookie', cookie)
      .send({ cancellationReason: 'לא' });
    expect(steal.status).toBe(404);
    expect((await Appointment.findById(otherApt._id))?.status).toBe('confirmed');

    const me = await request(app).get('/api/public/session/me').set('Cookie', cookie);
    expect(me.body.verified).toBe(false);
    expect(me.body.firstName).toBeUndefined();
    expect(me.body.hasVisibleAppointments).toBe(true);
    const upcoming = await request(app).get('/api/public/appointments/upcoming').set('Cookie', cookie);
    expect(upcoming.status).toBe(200);
    expect(upcoming.body.appointments.length).toBe(1);
    expect(upcoming.body.appointment.id).toBe(booked.body.id);
    expect(upcoming.body.appointment.time).toBe('10:00');
    expect(upcoming.body.customerName).toBeUndefined();

    const other = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/start`)
      .send({ phone: '0505555555' });
    const otherCookie = sessionCookie(other);
    const otherMe = await request(app).get('/api/public/session/me').set('Cookie', otherCookie);
    expect(otherMe.body.firstName).toBeUndefined();
    expect(otherMe.body.hasVisibleAppointments).toBe(false);
    const otherList = await request(app).get('/api/public/appointments/upcoming').set('Cookie', otherCookie);
    expect(otherList.status).toBe(200);
    expect(otherList.body.appointment).toBeNull();
    expect(otherList.body.appointments.length).toBe(0);

    const moved = await request(app)
      .post(`/api/public/appointments/${booked.body.id}/reschedule`)
      .set('Cookie', cookie)
      .send({ date, time: '12:00' });
    expect(moved.status).toBe(201);
    const afterMove = await request(app).get('/api/public/appointments/upcoming').set('Cookie', cookie);
    expect(afterMove.body.appointments.length).toBe(1);
    expect(afterMove.body.appointment.id).toBe(moved.body.id);
    expect(afterMove.body.appointment.time).toBe('12:00');
    const movedRow = await Appointment.findById(moved.body.id);
    expect(movedRow?.createdBySessionId).toBe(decodeURIComponent(sessionId));

    const cancel = await request(app)
      .delete(`/api/public/appointments/${moved.body.id}`)
      .set('Cookie', cookie)
      .send({ cancellationReason: 'לא יכולה' });
    expect(cancel.status).toBe(200);
    const afterCancel = await request(app).get('/api/public/appointments/upcoming').set('Cookie', cookie);
    expect(afterCancel.body.appointment).toBeNull();
    const afterMe = await request(app).get('/api/public/session/me').set('Cookie', cookie);
    expect(afterMe.body.hasVisibleAppointments).toBe(false);
    expect(afterMe.body.firstName).toBeUndefined();
  });

  it('a verified session still sees every upcoming appointment', async () => {
    const { business } = await seedOwner();
    const service = await seedService(business._id);
    await seedBusinessSettings(business._id);
    const customer = await Customer.create({
      businessId: business._id,
      name: 'Noa Levi',
      firstName: 'Noa',
      phone: '0504444444',
    });
    const start = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    start.setUTCHours(11, 0, 0, 0);
    const older = await Appointment.create({
      businessId: business._id,
      customerId: customer._id,
      serviceId: service._id,
      start,
      end: new Date(start.getTime() + 60 * 60 * 1000),
      status: 'confirmed',
      source: 'owner',
    });
    await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/start`)
      .send({ phone: '0504444444' });
    const verify = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/verify`)
      .send({ phone: '0504444444', code: await otpCode(business.slug, '0504444444') });
    const cookie = sessionCookie(verify);
    const me = await request(app).get('/api/public/session/me').set('Cookie', cookie);
    expect(me.body.verified).toBe(true);
    expect(me.body.firstName).toBe('Noa');
    expect(me.body.hasVisibleAppointments).toBe(true);
    const upcoming = await request(app).get('/api/public/appointments/upcoming').set('Cookie', cookie);
    expect(upcoming.status).toBe(200);
    expect(upcoming.body.appointments.length).toBe(1);
    expect(upcoming.body.appointment.id).toBe(older._id.toString());
  });

  it('uses the customer duration and ignores a client-sent price', async () => {
    process.env.IDENTITY_MODE = 'phone';
    const { business } = await seedOwner();
    const service = await seedService(business._id);
    await seedBusinessSettings(business._id);
    const customer = await Customer.create({
      businessId: business._id,
      name: 'Noa Levi',
      phone: '0506666666',
    });
    await CustomerServiceConfig.create({
      businessId: business._id,
      customerId: customer._id,
      serviceId: service._id,
      durationOverrideMinutes: 15,
      priceOverride: 250,
    });
    const start = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/start`)
      .send({ phone: '0506666666' });
    const cookie = sessionCookie(start);
    const date = tomorrowKey();
    const guest = await request(app).get(
      `/api/public/businesses/${business.slug}/availability?serviceId=${service._id.toString()}&date=${date}`
    );
    const mine = await request(app)
      .get(`/api/public/businesses/${business.slug}/availability?serviceId=${service._id.toString()}&date=${date}`)
      .set('Cookie', cookie);
    expect(guest.status).toBe(200);
    expect(mine.status).toBe(200);
    expect(mine.body.slots.length > guest.body.slots.length).toBe(true);

    const booked = await request(app)
      .post('/api/public/appointments')
      .set('Cookie', cookie)
      .send({
        businessId: business._id.toString(),
        serviceId: service._id.toString(),
        date,
        time: '10:00',
        customerName: 'Hacker',
        customerPhone: '0500000000',
        price: 1,
        durationMinutes: 5,
      });
    expect(booked.status).toBe(201);
    const stored = await Appointment.findById(booked.body.id);
    expect(stored?.price).toBe(250);
    expect((stored!.end.getTime() - stored!.start.getTime()) / 60000).toBe(15);
    expect(stored?.customerId?.toString()).toBe(customer._id.toString());
  });

  it('validates birthday and creates a new client', async () => {
    const { business } = await seedOwner();
    const phone = '0507777777';
    await request(app).post(`/api/public/businesses/${business.slug}/identify/start`).send({ phone });
    const verify = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/verify`)
      .send({ phone, code: await otpCode(business.slug, phone) });
    expect(verify.body.sessionId).toBeUndefined();
    const cookie = sessionCookie(verify);
    const me = await request(app).get('/api/public/session/me').set('Cookie', cookie);
    expect(me.body.verified).toBe(true);
    expect(me.body.needsBirthday).toBe(true);
    expect(me.body.firstName).toBeUndefined();

    const invalid = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/complete`)
      .set('Cookie', cookie)
      .send({ name: 'Dana Cohen', birthday: { day: 31, month: 4 } });
    expect(invalid.status).toBe(400);

    const leap = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/complete`)
      .set('Cookie', cookie)
      .send({ name: 'Dana Cohen', birthday: { day: 29, month: 2 } });
    expect(leap.status).toBe(200);
    expect(leap.body.needsBirthday).toBe(false);
    const customer = await Customer.findOne({ businessId: business._id, phone });
    expect(customer?.birthday?.day).toBe(29);
    expect(customer?.birthday?.month).toBe(2);
    const named = await request(app).get('/api/public/session/me').set('Cookie', cookie);
    expect(named.body.firstName).toBe('Dana');
  });

  it('a brand-new phone-mode client sees the booking it just made, and nothing else', async () => {
    process.env.IDENTITY_MODE = 'phone';
    const { business } = await seedOwner();
    const service = await seedService(business._id);
    await seedBusinessSettings(business._id);

    const start = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/start`)
      .send({ phone: '0507777771' });
    expect(start.body.status).toBe('new');
    const cookie = sessionCookie(start);
    const complete = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/complete`)
      .set('Cookie', cookie)
      .send({ name: 'Dana Cohen', birthday: { day: 4, month: 5 } });
    expect(complete.status).toBe(200);

    const beforeMe = await request(app).get('/api/public/session/me').set('Cookie', cookie);
    expect(beforeMe.body.hasVisibleAppointments).toBe(false);

    const when = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    when.setUTCHours(10, 0, 0, 0);
    const booked = await request(app)
      .post('/api/public/appointments')
      .set('Cookie', cookie)
      .send({
        slug: business.slug,
        serviceId: service._id.toString(),
        date: when.toISOString().slice(0, 10),
        time: '10:00',
      });
    expect(booked.status).toBe(201);
    const stored = await Appointment.findById(booked.body.id);
    expect(stored?.createdBySessionId).toBe(decodeURIComponent(sessionIdFromCookie(cookie)));

    const me = await request(app).get('/api/public/session/me').set('Cookie', cookie);
    expect(me.body.verified).toBe(false);
    expect(me.body.firstName).toBeUndefined();
    expect(me.body.hasVisibleAppointments).toBe(true);
    const upcoming = await request(app).get('/api/public/appointments/upcoming').set('Cookie', cookie);
    expect(upcoming.body.appointments.length).toBe(1);
    expect(upcoming.body.appointment.id).toBe(booked.body.id);
    expect(upcoming.body.customerName).toBeUndefined();

    const otherDevice = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/start`)
      .send({ phone: '0507777771' });
    const otherCookie = sessionCookie(otherDevice);
    const otherMe = await request(app).get('/api/public/session/me').set('Cookie', otherCookie);
    expect(otherMe.body.hasVisibleAppointments).toBe(false);
    expect(otherMe.body.firstName).toBeUndefined();
    const otherList = await request(app).get('/api/public/appointments/upcoming').set('Cookie', otherCookie);
    expect(otherList.body.appointments.length).toBe(0);
    const cancelFromOther = await request(app)
      .delete(`/api/public/appointments/${booked.body.id}`)
      .set('Cookie', otherCookie)
      .send({ cancellationReason: 'no' });
    expect(cancelFromOther.status).toBe(404);
  });

  it('applies the cancellation window and status rules to a booking the session made', async () => {
    process.env.IDENTITY_MODE = 'phone';
    const { business } = await seedOwner();
    const service = await seedService(business._id);
    await seedBusinessSettings(business._id);
    await BusinessSettings.updateOne({ businessId: business._id }, { $set: { cancellationWindowHours: 24 * 10 } });
    await Customer.create({ businessId: business._id, name: 'Noa Levi', firstName: 'Noa', phone: '0507777772' });
    const start = await request(app)
      .post(`/api/public/businesses/${business.slug}/identify/start`)
      .send({ phone: '0507777772' });
    const cookie = sessionCookie(start);
    const when = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    when.setUTCHours(10, 0, 0, 0);
    const date = when.toISOString().slice(0, 10);
    const booked = await request(app)
      .post('/api/public/appointments')
      .set('Cookie', cookie)
      .send({ slug: business.slug, serviceId: service._id.toString(), date, time: '10:00' });
    expect(booked.status).toBe(201);

    const list = await request(app).get('/api/public/appointments/upcoming').set('Cookie', cookie);
    expect(list.body.appointment.canChange).toBe(false);
    const cancel = await request(app)
      .delete(`/api/public/appointments/${booked.body.id}`)
      .set('Cookie', cookie)
      .send({ cancellationReason: 'late' });
    expect(cancel.status).toBe(409);
    expect(cancel.body.code).toBe('OUTSIDE_CANCELLATION_WINDOW');
    const move = await request(app)
      .post(`/api/public/appointments/${booked.body.id}/reschedule`)
      .set('Cookie', cookie)
      .send({ date, time: '12:00' });
    expect(move.status).toBe(409);
    expect(move.body.code).toBe('OUTSIDE_CANCELLATION_WINDOW');

    await BusinessSettings.updateOne({ businessId: business._id }, { $set: { cancellationWindowHours: 24 } });
    await Appointment.updateOne({ _id: booked.body.id }, { $set: { status: 'completed' } });
    const done = await request(app)
      .delete(`/api/public/appointments/${booked.body.id}`)
      .set('Cookie', cookie)
      .send({ cancellationReason: 'done' });
    expect(done.status).toBe(409);
    expect(done.body.code).toBe('APPOINTMENT_NOT_CANCELLABLE');
    const gone = await request(app).get('/api/public/appointments/upcoming').set('Cookie', cookie);
    expect(gone.body.appointment).toBeNull();
  });

  it('finds the booking on a device remembered at two businesses when the request names its business', async () => {
    process.env.IDENTITY_MODE = 'phone';
    const first = await seedOwner({ email: 'a2@test.com' });
    const second = await seedOwner({ email: 'b2@test.com' });
    const service = await seedService(first.business._id);
    await seedBusinessSettings(first.business._id);
    await seedBusinessSettings(second.business._id);
    await Customer.create({ businessId: first.business._id, name: 'Noa', firstName: 'Noa', phone: '0507777773' });
    const startA = await request(app)
      .post(`/api/public/businesses/${first.business.slug}/identify/start`)
      .send({ phone: '0507777773' });
    const cookie = sessionCookie(startA);
    await request(app)
      .post(`/api/public/businesses/${second.business.slug}/identify/start`)
      .set('Cookie', cookie)
      .send({ phone: '0507777773' });
    const when = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    when.setUTCHours(10, 0, 0, 0);
    const booked = await request(app)
      .post('/api/public/appointments')
      .set('Cookie', cookie)
      .send({
        slug: first.business.slug,
        serviceId: service._id.toString(),
        date: when.toISOString().slice(0, 10),
        time: '10:00',
      });
    expect(booked.status).toBe(201);

    const named = await request(app)
      .get(`/api/public/appointments/upcoming?slug=${first.business.slug}`)
      .set('Cookie', cookie);
    expect(named.body.appointments.length).toBe(1);
    const other = await request(app)
      .get(`/api/public/appointments/upcoming?slug=${second.business.slug}`)
      .set('Cookie', cookie);
    expect(other.body.appointments.length).toBe(0);
    const cancel = await request(app)
      .delete(`/api/public/appointments/${booked.body.id}?slug=${first.business.slug}`)
      .set('Cookie', cookie)
      .send({ cancellationReason: 'cannot' });
    expect(cancel.status).toBe(200);
  });

  it('keeps a separate binding per business on one device cookie', async () => {
    process.env.IDENTITY_MODE = 'phone';
    const first = await seedOwner({ email: 'a@test.com' });
    const second = await seedOwner({ email: 'b@test.com' });
    const serviceA = await seedService(first.business._id);
    const serviceB = await seedService(second.business._id);
    await seedBusinessSettings(first.business._id);
    await seedBusinessSettings(second.business._id);
    const customer = await Customer.create({
      businessId: first.business._id,
      name: 'Noa',
      phone: '0508888881',
    });
    await CustomerServiceConfig.create({
      businessId: first.business._id,
      customerId: customer._id,
      serviceId: serviceA._id,
      durationOverrideMinutes: 15,
    });
    const startA = await request(app)
      .post(`/api/public/businesses/${first.business.slug}/identify/start`)
      .send({ phone: '0508888881' });
    const cookie = sessionCookie(startA);
    const deviceId = sessionIdFromCookie(cookie);
    const date = tomorrowKey();
    const guestB = await request(app).get(
      `/api/public/businesses/${second.business.slug}/availability?serviceId=${serviceB._id.toString()}&date=${date}`
    );
    const asA = await request(app)
      .get(
        `/api/public/businesses/${second.business.slug}/availability?serviceId=${serviceB._id.toString()}&date=${date}`
      )
      .set('Cookie', cookie);
    expect(asA.body.slots.length).toBe(guestB.body.slots.length);

    const guestBook = await request(app)
      .post('/api/public/appointments')
      .set('Cookie', cookie)
      .send({
        businessId: second.business._id.toString(),
        serviceId: serviceB._id.toString(),
        date,
        time: '11:00',
        customerName: 'Guest On B',
        customerPhone: '0508888883',
      });
    expect(guestBook.status).toBe(401);
    expect(await Appointment.countDocuments({ businessId: second.business._id })).toBe(0);

    const startB = await request(app)
      .post(`/api/public/businesses/${second.business.slug}/identify/start`)
      .set('Cookie', cookie)
      .send({ phone: '0508888882' });
    expect(startB.body.sessionId).toBeUndefined();
    expect(sessionIdFromCookie(sessionCookie(startB))).toBe(deviceId);
    const stored = await PublicClientSession.findOne({ sessionId: deviceId });
    expect(stored?.bindings.length).toBe(2);

    const meA = await request(app)
      .get(`/api/public/session/me?slug=${first.business.slug}`)
      .set('Cookie', cookie);
    const meB = await request(app)
      .get(`/api/public/session/me?slug=${second.business.slug}`)
      .set('Cookie', cookie);
    expect(meA.status).toBe(200);
    expect(meB.status).toBe(200);
    expect(meA.body.verified).toBe(false);
    expect(meB.body.verified).toBe(false);

    const dropped = await request(app)
      .post(`/api/public/session/logout?slug=${second.business.slug}`)
      .set('Cookie', cookie);
    expect(dropped.status).toBe(200);
    const meBAfter = await request(app)
      .get(`/api/public/session/me?slug=${second.business.slug}`)
      .set('Cookie', cookie);
    const meAAfter = await request(app)
      .get(`/api/public/session/me?slug=${first.business.slug}`)
      .set('Cookie', cookie);
    expect(meBAfter.status).toBe(401);
    expect(meAAfter.status).toBe(200);
  });

  it('exposes identity config and keeps backoffice birthday optional', async () => {
    const { business, token } = await seedOwner();
    const config = await request(app).get(`/api/public/businesses/${business.slug}/config`);
    expect(config.status).toBe(200);
    expect(config.body.identityMode).toBe('otp');
    expect(config.body.birthdayField).toBe('required');

    const staffHash = await bcrypt.hash('StaffPass123!', 4);
    const staff = await User.create({
      email: 'staff-bday@test.com',
      passwordHash: staffHash,
      role: 'staff',
      status: 'active',
      businessId: business._id,
    });
    const staffToken = signTestToken({
      userId: staff._id.toString(),
      role: 'staff',
      email: staff.email,
      businessId: business._id.toString(),
    });
    const denied = await request(app)
      .put('/api/customers/birthday-field')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ birthdayField: 'hidden' });
    expect(denied.status).toBe(403);

    const updated = await request(app)
      .put('/api/customers/birthday-field')
      .set('Authorization', `Bearer ${token}`)
      .send({ birthdayField: 'optional' });
    expect(updated.status).toBe(200);
    expect(updated.body.birthdayField).toBe('optional');
    const audits = await AuditLog.find({ action: 'business.birthday_field_updated' });
    expect(audits.length).toBe(1);

    const created = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Optional', phone: '0509999999' });
    expect(created.status).toBe(201);
    expect(created.body.birthday).toBeUndefined();

    const invalid = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad day', phone: '0509999998', birthday: { day: 31, month: 4 } });
    expect(invalid.status).toBe(400);
  });

  it('applies the OTP rate limits to identify/start in phone mode', async () => {
    const layer = publicRouter.stack.find((entry) => {
      const route = entry.route as { path?: string; methods?: { post?: boolean }; stack?: { handle: unknown }[] } | undefined;
      return route?.path === '/businesses/:slug/identify/start' && route.methods?.post === true;
    });
    const route = layer?.route as { stack?: { handle: unknown }[] } | undefined;
    const handles = (route?.stack ?? []).map((entry) => entry.handle);
    expect(handles.includes(otpIpRouteLimiter)).toBe(true);
    expect(handles.includes(otpRouteLimiter)).toBe(true);

    const hit = (limiter: typeof otpRouteLimiter, phone: string, ip: string) =>
      new Promise<number>((resolve, reject) => {
        const req = {
          ip,
          params: { slug: 'rate-check' },
          body: { phone },
          headers: {},
          cookies: {},
          method: 'POST',
          path: '/identify/start',
          app: { get: () => false },
        } as unknown as Request;
        const res = {
          statusCode: 200,
          headers: {} as Record<string, string>,
          setHeader(name: string, value: string) {
            this.headers[name.toLowerCase()] = value;
          },
          getHeader(name: string) {
            return this.headers[name.toLowerCase()];
          },
          status(code: number) {
            this.statusCode = code;
            return this;
          },
          json() {
            resolve(this.statusCode);
            return this;
          },
        };
        limiter(req, res as unknown as Response, (err?: unknown) => {
          if (err) reject(err);
          else resolve(res.statusCode);
        });
      });

    let phoneStatus = 200;
    for (let i = 0; i < 51; i++) {
      phoneStatus = await hit(otpRouteLimiter, '0501000001', '203.0.113.21');
    }
    expect(phoneStatus).toBe(429);

    let ipStatus = 200;
    for (let i = 0; i < 201; i++) {
      ipStatus = await hit(otpIpRouteLimiter, `0502${String(i).padStart(6, '0')}`, '203.0.113.22');
    }
    expect(ipStatus).toBe(429);
  });
});
