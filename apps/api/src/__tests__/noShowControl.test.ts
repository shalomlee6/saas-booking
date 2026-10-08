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
import { migrateNoShowResets } from '../services/customerNoShows';
import { ONLINE_BOOKING_UNAVAILABLE } from '../services/publicBookingPolicy';

const app = buildTestApp();

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

function tomorrowKey(): string {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function addNoShow(
  businessId: unknown,
  customerId: unknown,
  serviceId: unknown,
  days: number,
  extra: { excused?: boolean; price?: number; status?: string } = {}
) {
  const start = daysAgo(days);
  return Appointment.create({
    businessId,
    customerId,
    serviceId,
    start,
    end: new Date(start.getTime() + 60 * 60 * 1000),
    status: extra.status ?? 'no_show',
    source: 'owner',
    price: extra.price ?? 80,
    noShowExcused: extra.excused === true,
  });
}

async function seedStaff(businessId: unknown) {
  const passwordHash = await bcrypt.hash('StaffPass123!', 4);
  const user = await User.create({
    email: 'staff-control@test.com',
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

function historyOf(row: { status: string; start: Date; end: Date; price?: number }) {
  return `${row.status}|${row.start.toISOString()}|${row.end.toISOString()}|${row.price ?? ''}`;
}

describe('NO-SHOW CONTROL', () => {
  it('excludes excused no-shows and restores the count when one is un-excused', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    const customer = await Customer.create({
      businessId: business._id,
      name: 'Noa',
      phone: '0501234567',
    });
    const older = await addNoShow(business._id, customer._id, service._id, 9);
    const newer = await addNoShow(business._id, customer._id, service._id, 2);
    const before = [older, newer].map((row) => historyOf(row));

    const excused = await request(app)
      .post(`/api/customers/${customer._id.toString()}/no-shows/${older._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ excused: true, reason: '  called ahead  ' });
    expect(excused.status).toBe(200);
    expect(excused.body.noShowCount).toBe(1);
    expect(excused.body.blocked).toBe(false);

    const panel = await request(app)
      .get(`/api/customers/${customer._id.toString()}/no-show-control`)
      .set('Authorization', `Bearer ${token}`);
    expect(panel.status).toBe(200);
    expect(panel.body.noShows.length).toBe(2);
    const excusedRow = panel.body.noShows.find(
      (row: { id: string }) => row.id === older._id.toString()
    );
    expect(excusedRow.excused).toBe(true);
    expect(excusedRow.excusedReason).toBe('called ahead');

    const restored = await request(app)
      .post(`/api/customers/${customer._id.toString()}/no-shows/${older._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ excused: false });
    expect(restored.status).toBe(200);
    expect(restored.body.noShowCount).toBe(2);

    const stored = await Appointment.find({ customerId: customer._id }).sort({ start: 1 });
    expect(stored.map((row) => historyOf(row))).toEqual(before);
    const stats = await request(app)
      .get(`/api/customers/${customer._id.toString()}/stats`)
      .set('Authorization', `Bearer ${token}`);
    expect(stats.body.stats.completedVisits).toBe(0);
    expect(stats.body.stats.noShows).toBe(2);
  });

  it('applies each override against the threshold', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    const customer = await Customer.create({
      businessId: business._id,
      name: 'Noa',
      phone: '0501234567',
    });
    await addNoShow(business._id, customer._id, service._id, 4);
    await addNoShow(business._id, customer._id, service._id, 3);

    const under = await request(app)
      .get(`/api/customers/${customer._id.toString()}/no-show-control`)
      .set('Authorization', `Bearer ${token}`);
    expect(under.body.bookingOverride).toBe('auto');
    expect(under.body.noShowCount).toBe(2);
    expect(under.body.blocked).toBe(false);
    expect(under.body.blockReason).toBe('clear');

    await addNoShow(business._id, customer._id, service._id, 2);
    const atThreshold = await request(app)
      .get(`/api/customers/${customer._id.toString()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(atThreshold.body.blocked).toBe(true);
    expect(atThreshold.body.blockReason).toBe('threshold');

    await BusinessSettings.updateOne(
      { businessId: business._id },
      { $set: { noShowPolicy: { enabled: false, threshold: 3 } } }
    );
    const policyOff = await request(app)
      .get(`/api/customers/${customer._id.toString()}/no-show-control`)
      .set('Authorization', `Bearer ${token}`);
    expect(policyOff.body.blocked).toBe(false);
    expect(policyOff.body.blockReason).toBe('clear');

    const allowed = await request(app)
      .patch(`/api/customers/${customer._id.toString()}/booking-override`)
      .set('Authorization', `Bearer ${token}`)
      .send({ override: 'allow', reason: 'vip' });
    expect(allowed.status).toBe(200);
    expect(allowed.body.blocked).toBe(false);
    expect(allowed.body.blockReason).toBe('allowed');

    await BusinessSettings.updateOne(
      { businessId: business._id },
      { $set: { noShowPolicy: { enabled: true, threshold: 1 } } }
    );
    const stillAllowed = await request(app)
      .get(`/api/customers/${customer._id.toString()}/no-show-control`)
      .set('Authorization', `Bearer ${token}`);
    expect(stillAllowed.body.noShowCount).toBe(3);
    expect(stillAllowed.body.blocked).toBe(false);
    expect(stillAllowed.body.blockReason).toBe('allowed');

    const manual = await request(app)
      .patch(`/api/customers/${customer._id.toString()}/booking-override`)
      .set('Authorization', `Bearer ${token}`)
      .send({ override: 'block' });
    expect(manual.body.blocked).toBe(true);
    expect(manual.body.blockReason).toBe('manual');

    const list = await request(app)
      .get('/api/customers')
      .query({ page: 1, status: 'all', blocked: 'true' })
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].bookingOverride).toBe('block');
    expect(list.body.items[0].blocked).toBe(true);
  });

  it('lets allow bypass the public block and blocks a manual override with zero no-shows', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    const allowed = await Customer.create({
      businessId: business._id,
      name: 'Allowed',
      phone: '0501111111',
      bookingOverride: 'allow',
    });
    const blocked = await Customer.create({
      businessId: business._id,
      name: 'Blocked',
      phone: '0502222222',
      bookingOverride: 'block',
    });
    await addNoShow(business._id, allowed._id, service._id, 4);
    await addNoShow(business._id, allowed._id, service._id, 3);
    await addNoShow(business._id, allowed._id, service._id, 2);

    const open = await request(app)
      .post('/api/public/appointments')
      .send({
        businessId: business._id.toString(),
        serviceId: service._id.toString(),
        date: tomorrowKey(),
        time: '10:00',
        customerName: 'Allowed',
        customerPhone: '0501111111',
      });
    expect(open.status).toBe(201);

    const closed = await request(app)
      .post('/api/public/appointments')
      .send({
        businessId: business._id.toString(),
        serviceId: service._id.toString(),
        date: tomorrowKey(),
        time: '11:00',
        customerName: 'Blocked',
        customerPhone: '0502222222',
      });
    expect(closed.status).toBe(403);
    expect(closed.body.code).toBe('ONLINE_BOOKING_UNAVAILABLE');
    expect(closed.body.message).toBe(ONLINE_BOOKING_UNAVAILABLE.he);

    const zero = await request(app)
      .get(`/api/customers/${blocked._id.toString()}/no-show-control`)
      .set('Authorization', `Bearer ${token}`);
    expect(zero.body.noShowCount).toBe(0);
    expect(zero.body.blocked).toBe(true);
    expect(zero.body.blockReason).toBe('manual');
  });

  it('migrates noShowResetAt into excused no-shows and then removes the field', async () => {
    const { business } = await seedOwner();
    const service = await seedService(business._id);
    const customer = await Customer.create({
      businessId: business._id,
      name: 'Legacy',
      phone: '0503333333',
    });
    const resetAt = daysAgo(5);
    await Customer.collection.updateOne({ _id: customer._id }, { $set: { noShowResetAt: resetAt } });
    const oldNoShow = await addNoShow(business._id, customer._id, service._id, 9, { price: 40 });
    const newNoShow = await addNoShow(business._id, customer._id, service._id, 1, { price: 50 });
    const completed = await addNoShow(business._id, customer._id, service._id, 8, {
      status: 'completed',
      price: 70,
    });

    const first = await migrateNoShowResets();
    expect(first.appointmentsExcused).toBe(1);
    expect(first.customersCleared).toBe(1);

    const oldFresh = await Appointment.findById(oldNoShow._id);
    const newFresh = await Appointment.findById(newNoShow._id);
    const completedFresh = await Appointment.findById(completed._id);
    expect(oldFresh?.noShowExcused).toBe(true);
    expect(oldFresh?.status).toBe('no_show');
    expect(oldFresh?.price).toBe(40);
    expect(newFresh?.noShowExcused).toBe(false);
    expect(newFresh?.status).toBe('no_show');
    expect(completedFresh?.status).toBe('completed');
    expect(completedFresh?.noShowExcused).toBe(false);
    const stored = await Customer.collection.findOne({ _id: customer._id });
    expect(stored?.noShowResetAt == null).toBe(true);

    const second = await migrateNoShowResets();
    expect(second.appointmentsExcused).toBe(0);
    expect(second.customersCleared).toBe(0);
  });

  it('keeps mutations owner-only and leaves appointment history unchanged', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id);
    const { token: staffToken } = await seedStaff(business._id);
    const customer = await Customer.create({
      businessId: business._id,
      name: 'Noa',
      phone: '0501234567',
    });
    const noShow = await addNoShow(business._id, customer._id, service._id, 3, { price: 90 });
    const visit = await addNoShow(business._id, customer._id, service._id, 6, {
      status: 'completed',
      price: 120,
    });
    const snapshot = [historyOf(visit), historyOf(noShow)];

    const staffRead = await request(app)
      .get(`/api/customers/${customer._id.toString()}/no-show-control`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(staffRead.status).toBe(200);

    const staffExcuse = await request(app)
      .post(`/api/customers/${customer._id.toString()}/no-shows/${noShow._id.toString()}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ excused: true });
    expect(staffExcuse.status).toBe(403);
    const staffAll = await request(app)
      .post(`/api/customers/${customer._id.toString()}/no-shows/excuse-all`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({});
    expect(staffAll.status).toBe(403);
    const staffOverride = await request(app)
      .patch(`/api/customers/${customer._id.toString()}/booking-override`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ override: 'block' });
    expect(staffOverride.status).toBe(403);

    const notNoShow = await request(app)
      .post(`/api/customers/${customer._id.toString()}/no-shows/${visit._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ excused: true });
    expect(notNoShow.status).toBe(400);

    const all = await request(app)
      .post(`/api/customers/${customer._id.toString()}/no-shows/excuse-all`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'forgiven' });
    expect(all.status).toBe(200);
    expect(all.body.excused).toBe(1);
    expect(all.body.noShowCount).toBe(0);

    const override = await request(app)
      .patch(`/api/customers/${customer._id.toString()}/booking-override`)
      .set('Authorization', `Bearer ${token}`)
      .send({ override: 'auto' });
    expect(override.status).toBe(200);
    const audits = await AuditLog.find({ action: 'customer.booking_override_updated' });
    expect(audits.length).toBe(0);

    const stored = await Appointment.find({ customerId: customer._id }).sort({ start: 1 });
    expect(stored.map((row) => historyOf(row))).toEqual(snapshot);
    const stats = await request(app)
      .get(`/api/customers/${customer._id.toString()}/stats`)
      .set('Authorization', `Bearer ${token}`);
    expect(stats.body.stats.completedVisits).toBe(1);
    expect(stats.body.stats.totalRevenue).toBe(120);
    const history = await request(app)
      .get(`/api/customers/${customer._id.toString()}/appointments`)
      .set('Authorization', `Bearer ${token}`);
    expect(history.body.length).toBe(2);
    const statuses = history.body.map((row: { status: string }) => row.status).sort();
    expect(statuses[0]).toBe('completed');
    expect(statuses[1]).toBe('no_show');
  });
});
