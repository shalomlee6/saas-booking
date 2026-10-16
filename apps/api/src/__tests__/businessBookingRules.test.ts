import request from 'supertest';
import bcrypt from 'bcryptjs';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedService, seedBusinessSettings, seedCustomer, signTestToken } from './helpers/seed';
import { loginPublicClient } from './helpers/publicSession';
import { Appointment } from '../models/Appointment';
import { AuditLog } from '../models/AuditLog';
import { BusinessSettings } from '../models/BusinessSettings';
import { Customer } from '../models/Customer';
import { User } from '../models/User';
import {
  BOOKING_RULE_MESSAGES,
  buildClientPolicyText,
  isBeforeLead,
  isBeyondMaxAdvance,
  resolveOnlineBookingRules,
} from '../services/bookingRules';
import { resolveReliabilityPolicy } from '../services/customerNoShows';

const app = buildTestApp();
const LEADS = [0, 30, 60, 120, 180, 360, 720, 1440];

function rulesBody(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    minLeadMinutes: 60,
    maxAdvanceDays: 60,
    bufferMinutes: 0,
    onlineDefaultStatus: 'confirmed',
    maxActiveAppointmentsPerClient: null,
    clientCanCancelOnline: true,
    cancellationWindowHours: 24,
    ...overrides,
  };
}

function reliabilityBody(overrides: Record<string, unknown> = {}) {
  return {
    noShow: { enabled: true, threshold: 3 },
    lateCancellation: { enabled: false, threshold: 3 },
    lateArrival: { enabled: false, threshold: 3 },
    lookback: '12months',
    ...overrides,
  };
}

function utcDay(offsetDays: number): string {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + offsetDays);
  return day.toISOString().slice(0, 10);
}

function soonSlot(): { date: string; time: string; minutesAhead: number } {
  let start = new Date(Date.now() + 90 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  if (start.getUTCDate() !== end.getUTCDate()) {
    start = new Date(start);
    start.setUTCDate(start.getUTCDate() + 1);
    start.setUTCHours(12, 0, 0, 0);
  }
  return {
    date: start.toISOString().slice(0, 10),
    time: start.toISOString().slice(11, 16),
    minutesAhead: (start.getTime() - Date.now()) / 60000,
  };
}

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

describe('booking rule helpers', () => {
  it('treats the lead instant as allowed and the previous minute as too soon', () => {
    const now = new Date('2026-06-01T10:00:00.000Z');
    expect(isBeforeLead(new Date('2026-06-01T11:00:00.000Z'), 60, now)).toBe(false);
    expect(isBeforeLead(new Date('2026-06-01T10:59:00.000Z'), 60, now)).toBe(true);
  });

  it('allows the last advance day and rejects the next one', () => {
    const now = new Date('2026-06-01T10:00:00.000Z');
    expect(isBeyondMaxAdvance('2026-07-31', 60, 'UTC', now)).toBe(false);
    expect(isBeyondMaxAdvance('2026-08-01', 60, 'UTC', now)).toBe(true);
  });

  it('builds Hebrew and English policy text from the saved rules', () => {
    const rules = resolveOnlineBookingRules({
      cancellationWindowHours: 24,
      onlineBooking: { minLeadMinutes: 60, maxAdvanceDays: 60, maxActiveAppointmentsPerClient: 2 },
    });
    const reliability = resolveReliabilityPolicy({
      noShowPolicy: { enabled: true, threshold: 3 },
      reliability: { lookback: '12months', lateCancellation: { enabled: true, threshold: 2 } },
    });
    const he = buildClientPolicyText(rules, reliability, 'he');
    const en = buildClientPolicyText(rules, reliability, 'en');
    expect(he.includes('60 דקות')).toBe(true);
    expect(he.includes('24 שעות')).toBe(true);
    expect(he.includes('2 תורים')).toBe(true);
    expect(he.includes('3 אי-הגעות')).toBe(true);
    expect(he.includes('2 ביטולים מאוחרים')).toBe(true);
    expect(en.includes('60 minutes')).toBe(true);
    expect(en.includes('24 hours')).toBe(true);
    expect(en.includes('2 upcoming')).toBe(true);
  });

  it('keeps confirmed as the default online status', () => {
    expect(resolveOnlineBookingRules(null).onlineDefaultStatus).toBe('confirmed');
    expect(resolveOnlineBookingRules(null).minLeadMinutes).toBe(60);
    expect(resolveOnlineBookingRules(null).maxActiveAppointmentsPerClient).toBeNull();
  });
});

describe('BUSINESS BOOKING RULES', () => {
  async function setup() {
    const owner = await seedOwner();
    const service = await seedService(owner.business._id);
    await seedBusinessSettings(owner.business._id);
    const session = await loginPublicClient(app, owner.business.slug, '0501234567', { name: 'Dana' });
    return { ...owner, service, session };
  }

  async function saveRules(token: string, overrides: Record<string, unknown> = {}) {
    return request(app)
      .put('/api/settings/me/booking-rules')
      .set('Authorization', `Bearer ${token}`)
      .send(rulesBody(overrides));
  }

  async function book(
    businessId: string,
    serviceId: string,
    cookie: string,
    date: string,
    time: string
  ) {
    return request(app)
      .post('/api/public/appointments')
      .set('Cookie', cookie)
      .set('Accept-Language', 'he')
      .send({ businessId, serviceId, date, time });
  }

  it('rejects a slot inside the lead and accepts one outside it', async () => {
    const { business, token, service, session } = await setup();
    const slot = soonSlot();
    const rejectLead = LEADS.find((minutes) => minutes > slot.minutesAhead) ?? 1440;
    const allowLead = [...LEADS].reverse().find((minutes) => minutes <= slot.minutesAhead) ?? 0;

    const blockedSave = await saveRules(token, { minLeadMinutes: rejectLead });
    expect(blockedSave.status).toBe(200);
    const blocked = await book(business._id.toString(), service._id.toString(), session.cookie, slot.date, slot.time);
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('TOO_SOON');
    expect(blocked.body.message).toBe(BOOKING_RULE_MESSAGES.TOO_SOON.he);

    const allowedSave = await saveRules(token, { minLeadMinutes: allowLead });
    expect(allowedSave.status).toBe(200);
    const allowed = await book(business._id.toString(), service._id.toString(), session.cookie, slot.date, slot.time);
    expect(allowed.status).toBe(201);
  });

  it('rejects a date past maxAdvanceDays and allows the last day', async () => {
    const { business, token, service, session } = await setup();
    await saveRules(token, { maxAdvanceDays: 7, minLeadMinutes: 0 });
    const last = await book(business._id.toString(), service._id.toString(), session.cookie, utcDay(7), '12:00');
    expect(last.status).toBe(201);
    const past = await book(business._id.toString(), service._id.toString(), session.cookie, utcDay(8), '12:00');
    expect(past.status).toBe(409);
    expect(past.body.code).toBe('TOO_FAR');
  });

  it('keeps a buffer after each appointment without changing the stored end', async () => {
    const { business, token, service } = await setup();
    const customer = await seedCustomer(business._id);
    await saveRules(token, { bufferMinutes: 15, minLeadMinutes: 0 });
    const start = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    start.setUTCHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const first = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        serviceId: service._id.toString(),
        customerId: customer._id.toString(),
        start: start.toISOString(),
        end: end.toISOString(),
      });
    expect(first.status).toBe(201);
    const stored = await Appointment.findOne({ businessId: business._id, customerId: customer._id });
    expect(stored?.end.toISOString()).toBe(end.toISOString());

    const tight = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        serviceId: service._id.toString(),
        customerId: customer._id.toString(),
        start: end.toISOString(),
        end: new Date(end.getTime() + 60 * 60 * 1000).toISOString(),
      });
    expect(tight.status).toBe(409);
    expect(tight.body.code).toBe('SLOT_TAKEN');

    const afterBuffer = new Date(end.getTime() + 15 * 60 * 1000);
    const fits = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        serviceId: service._id.toString(),
        customerId: customer._id.toString(),
        start: afterBuffer.toISOString(),
        end: new Date(afterBuffer.getTime() + 60 * 60 * 1000).toISOString(),
      });
    expect(fits.status).toBe(201);
  });

  it('closes online booking without hiding the public business', async () => {
    const { business, token, service, session } = await setup();
    await saveRules(token, { enabled: false });
    const info = await request(app).get(`/api/public/businesses/${business.slug}`);
    expect(info.status).toBe(200);
    expect(info.body.onlineBooking.enabled).toBe(false);
    expect(typeof info.body.clientPolicy.he).toBe('string');
    const created = await book(business._id.toString(), service._id.toString(), session.cookie, utcDay(2), '12:00');
    expect(created.status).toBe(403);
    expect(created.body.code).toBe('ONLINE_BOOKING_DISABLED');
  });

  it('stores the configured online status and defaults to confirmed', async () => {
    const { business, token, service, session } = await setup();
    const confirmed = await book(business._id.toString(), service._id.toString(), session.cookie, utcDay(2), '11:00');
    expect(confirmed.status).toBe(201);
    expect(confirmed.body.status).toBe('confirmed');

    await saveRules(token, { onlineDefaultStatus: 'pending', minLeadMinutes: 0 });
    const pending = await book(business._id.toString(), service._id.toString(), session.cookie, utcDay(3), '11:00');
    expect(pending.status).toBe(201);
    expect(pending.body.status).toBe('pending');
  });

  it('rejects online cancellation when the owner turns it off', async () => {
    const { business, token, service, session } = await setup();
    await saveRules(token, { minLeadMinutes: 0, cancellationWindowHours: 0 });
    const created = await book(business._id.toString(), service._id.toString(), session.cookie, utcDay(2), '15:00');
    expect(created.status).toBe(201);
    await saveRules(token, { minLeadMinutes: 0, clientCanCancelOnline: false, cancellationWindowHours: 0 });
    const cancelled = await request(app)
      .delete(`/api/public/appointments/${created.body.id}`)
      .set('Cookie', session.cookie)
      .send({ cancellationReason: 'plans changed' });
    expect(cancelled.status).toBe(409);
    expect(cancelled.body.code).toBe('ONLINE_CANCEL_DISABLED');
    expect(cancelled.body.message).toBe(BOOKING_RULE_MESSAGES.ONLINE_CANCEL_DISABLED.he);
  });

  it('caps online creates, still allows a reschedule, and only warns the owner', async () => {
    const { business, token, service, session } = await setup();
    await saveRules(token, { minLeadMinutes: 0, maxActiveAppointmentsPerClient: 1, cancellationWindowHours: 0 });
    const first = await book(business._id.toString(), service._id.toString(), session.cookie, utcDay(2), '10:00');
    expect(first.status).toBe(201);
    const second = await book(business._id.toString(), service._id.toString(), session.cookie, utcDay(3), '10:00');
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('MAX_ACTIVE_APPOINTMENTS');
    expect(second.body.message).toBe(BOOKING_RULE_MESSAGES.MAX_ACTIVE_APPOINTMENTS.he);

    const moved = await request(app)
      .post(`/api/public/appointments/${first.body.id}/reschedule`)
      .set('Cookie', session.cookie)
      .send({ date: utcDay(4), time: '10:00' });
    expect(moved.status).toBe(201);

    const customer = await Customer.findOne({ businessId: business._id, phone: '0501234567' });
    const ownerCreate = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        serviceId: service._id.toString(),
        customerId: customer!._id.toString(),
        start: new Date(`${utcDay(5)}T10:00:00.000Z`).toISOString(),
        end: new Date(`${utcDay(5)}T11:00:00.000Z`).toISOString(),
      });
    expect(ownerCreate.status).toBe(201);
    const warning = await request(app)
      .get(`/api/customers/${customer!._id.toString()}/active-limit`)
      .set('Authorization', `Bearer ${token}`);
    expect(warning.status).toBe(200);
    expect(warning.body.limit).toBe(1);
    expect(warning.body.atOrAboveLimit).toBe(true);
    expect(warning.body.activeCount >= 1).toBe(true);
  });

  it('blocks from any enabled reliability counter, honors lookback and excuse, and respects overrides', async () => {
    const { business, token, service, session } = await setup();
    await saveRules(token, { minLeadMinutes: 0 });
    const customer = await Customer.findOne({ businessId: business._id });
    const oldStart = new Date();
    oldStart.setMonth(oldStart.getMonth() - 13);
    await Appointment.create({
      businessId: business._id,
      serviceId: service._id,
      customerId: customer!._id,
      start: oldStart,
      end: new Date(oldStart.getTime() + 60 * 60 * 1000),
      status: 'no_show',
      source: 'owner',
    });
    const recent = new Date();
    recent.setDate(recent.getDate() - 3);
    const late = await Appointment.create({
      businessId: business._id,
      serviceId: service._id,
      customerId: customer!._id,
      start: recent,
      end: new Date(recent.getTime() + 60 * 60 * 1000),
      status: 'cancelled',
      lateCancellation: true,
      source: 'owner',
    });

    const stillOpen = await book(business._id.toString(), service._id.toString(), session.cookie, utcDay(2), '16:00');
    expect(stillOpen.status).toBe(201);
    await Appointment.deleteOne({ _id: stillOpen.body.id });

    await request(app)
      .put('/api/settings/me/reliability')
      .set('Authorization', `Bearer ${token}`)
      .send(reliabilityBody({ noShow: { enabled: true, threshold: 1 }, lookback: '12months' }));
    const ignoredOld = await book(
      business._id.toString(),
      service._id.toString(),
      session.cookie,
      utcDay(2),
      '16:00'
    );
    expect(ignoredOld.status).toBe(201);
    await Appointment.deleteOne({ _id: ignoredOld.body.id });

    await request(app)
      .put('/api/settings/me/reliability')
      .set('Authorization', `Bearer ${token}`)
      .send(
        reliabilityBody({
          noShow: { enabled: true, threshold: 1 },
          lateCancellation: { enabled: true, threshold: 1 },
          lookback: '12months',
        })
      );
    const blocked = await book(business._id.toString(), service._id.toString(), session.cookie, utcDay(2), '16:00');
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('ONLINE_BOOKING_UNAVAILABLE');

    await request(app)
      .put('/api/settings/me/reliability')
      .set('Authorization', `Bearer ${token}`)
      .send(reliabilityBody({ noShow: { enabled: true, threshold: 1 }, lookback: 'all' }));
    const allTime = await book(business._id.toString(), service._id.toString(), session.cookie, utcDay(2), '17:00');
    expect(allTime.status).toBe(403);

    await request(app)
      .put('/api/settings/me/reliability')
      .set('Authorization', `Bearer ${token}`)
      .send(reliabilityBody({ lateCancellation: { enabled: true, threshold: 1 }, noShow: { enabled: false, threshold: 3 } }));
    const excused = await request(app)
      .post(`/api/customers/${customer!._id.toString()}/no-shows/${late._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ excused: true, kind: 'late_cancellation', reason: 'traffic' });
    expect(excused.status).toBe(200);
    expect(excused.body.lateCancellationCount).toBe(0);
    const afterExcuse = await book(
      business._id.toString(),
      service._id.toString(),
      session.cookie,
      utcDay(2),
      '18:00'
    );
    expect(afterExcuse.status).toBe(201);

    customer!.bookingOverride = 'block';
    await customer!.save();
    await Appointment.deleteOne({ _id: afterExcuse.body.id });
    const manual = await book(business._id.toString(), service._id.toString(), session.cookie, utcDay(2), '18:00');
    expect(manual.status).toBe(403);

    customer!.bookingOverride = 'allow';
    await customer!.save();
    await request(app)
      .put('/api/settings/me/reliability')
      .set('Authorization', `Bearer ${token}`)
      .send(reliabilityBody({ lateCancellation: { enabled: true, threshold: 1 }, noShow: { enabled: true, threshold: 1 } }));
    await Appointment.updateOne({ _id: late._id }, { $set: { lateCancellationExcused: false } });
    const allowed = await book(business._id.toString(), service._id.toString(), session.cookie, utcDay(6), '12:00');
    expect(allowed.status).toBe(201);
  });

  it('lets only the owner change settings and writes an audit entry', async () => {
    const { business, token, user } = await setup();
    const staff = await User.create({
      email: 'staff@test.com',
      passwordHash: await bcrypt.hash('Password123!', 4),
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
    const denied = await saveRules(staffToken, { minLeadMinutes: 0 });
    expect(denied.status).toBe(403);

    const saved = await saveRules(token, { minLeadMinutes: 120, bufferMinutes: 10 });
    expect(saved.status).toBe(200);
    expect(saved.body.booking.minLeadMinutes).toBe(120);
    expect(saved.body.booking.bufferMinutes).toBe(10);
    const audit = await AuditLog.findOne({
      action: 'business.settings_updated',
      entityId: (await BusinessSettings.findOne({ businessId: business._id }))?._id.toString(),
    });
    expect(audit?.actorEmail).toBe(user.email);
    expect(audit?.metadata?.section).toBe('booking');
  });
});
