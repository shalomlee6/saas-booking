import request from 'supertest';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedService, seedBusinessSettings } from './helpers/seed';
import { Customer } from '../models/Customer';
import { CustomerServiceConfig } from '../models/CustomerServiceConfig';
import { Appointment } from '../models/Appointment';

const app = buildTestApp();

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

function futureDateStr(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

describe('CUSTOMER SERVICE CONFIG — CRUD', () => {
  it('creates, lists, updates, and deletes a service override', async () => {
    const { business, token } = await seedOwner();
    const service = await seedService(business._id);
    const customer = await Customer.create({ businessId: business._id, name: 'C1', phone: '111' });

    const createRes = await request(app)
      .post('/api/customer-service-configs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: customer._id.toString(),
        serviceId: service._id.toString(),
        durationOverrideMinutes: 90,
        priceOverride: 250,
      });
    expect(createRes.status).toBe(201);
    const configId = createRes.body._id;

    const listRes = await request(app)
      .get(`/api/customer-service-configs?customerId=${customer._id.toString()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].durationOverrideMinutes).toBe(90);
    expect(listRes.body[0].priceOverride).toBe(250);

    const updateRes = await request(app)
      .put(`/api/customer-service-configs/${configId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ durationOverrideMinutes: 120 });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.durationOverrideMinutes).toBe(120);
    expect(updateRes.body.priceOverride).toBe(250); // untouched field survives partial update

    const deleteRes = await request(app)
      .delete(`/api/customer-service-configs/${configId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);

    const afterDelete = await request(app)
      .get(`/api/customer-service-configs/${configId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(afterDelete.status).toBe(404);
  });

  it('rejects a duplicate (customer, service) config with 409', async () => {
    const { business, token } = await seedOwner();
    const service = await seedService(business._id);
    const customer = await Customer.create({ businessId: business._id, name: 'C1', phone: '111' });

    const payload = {
      customerId: customer._id.toString(),
      serviceId: service._id.toString(),
      durationOverrideMinutes: 90,
    };
    const r1 = await request(app)
      .post('/api/customer-service-configs')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(r1.status).toBe(201);

    const r2 = await request(app)
      .post('/api/customer-service-configs')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(r2.status).toBe(409);
  });

  it('does not let one tenant read another tenant\'s override', async () => {
    const ownerA = await seedOwner({ email: 'a@test.com' });
    const ownerB = await seedOwner({ email: 'b@test.com' });
    const service = await seedService(ownerA.business._id);
    const customer = await Customer.create({
      businessId: ownerA.business._id,
      name: 'C1',
      phone: '111',
    });

    const created = await request(app)
      .post('/api/customer-service-configs')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({
        customerId: customer._id.toString(),
        serviceId: service._id.toString(),
        durationOverrideMinutes: 90,
      });
    expect(created.status).toBe(201);

    const res = await request(app)
      .get(`/api/customer-service-configs/${created.body._id}`)
      .set('Authorization', `Bearer ${ownerB.token}`);
    expect(res.status).toBe(404);
  });
});

describe('CUSTOMER SERVICE CONFIG — availability engine wiring', () => {
  it('uses the override duration (not the service default) when creating a public booking', async () => {
    const { business } = await seedOwner();
    await seedBusinessSettings(business._id); // all-day hours, UTC timezone
    const service = await seedService(business._id); // 60 min default
    const customer = await Customer.create({
      businessId: business._id,
      name: 'Override Customer',
      phone: '972500000123',
    });
    await CustomerServiceConfig.create({
      businessId: business._id,
      customerId: customer._id,
      serviceId: service._id,
      durationOverrideMinutes: 90,
    });

    const res = await request(app)
      .post('/api/public/appointments')
      .send({
        businessId: business._id.toString(),
        serviceId: service._id.toString(),
        date: futureDateStr(7),
        time: '10:00',
        customerName: 'Override Customer',
        customerPhone: '972500000123',
      });

    expect(res.status).toBe(201);

    const created = await Appointment.findById(res.body.id);
    expect(created).not.toBeNull();
    expect(created!.durationMinutes).toBe(90);
    expect(created!.end.getTime() - created!.start.getTime()).toBe(90 * 60 * 1000);
  });

  it('falls back to the service default duration when no override exists', async () => {
    const { business } = await seedOwner();
    await seedBusinessSettings(business._id);
    const service = await seedService(business._id); // 60 min default

    const res = await request(app)
      .post('/api/public/appointments')
      .send({
        businessId: business._id.toString(),
        serviceId: service._id.toString(),
        date: futureDateStr(7),
        time: '11:00',
        customerName: 'No Override Customer',
        customerPhone: '972500000124',
      });

    expect(res.status).toBe(201);

    const created = await Appointment.findById(res.body.id);
    expect(created!.durationMinutes).toBe(60);
    expect(created!.end.getTime() - created!.start.getTime()).toBe(60 * 60 * 1000);
  });

  it('applies the override duration when the owner reassigns an appointment to this customer+service via PATCH', async () => {
    const { business, token } = await seedOwner();
    const service = await seedService(business._id); // 60 min
    const otherService = await seedService(business._id);
    await seedBusinessSettings(business._id);
    const customer = await Customer.create({ businessId: business._id, name: 'C1', phone: '111' });
    await CustomerServiceConfig.create({
      businessId: business._id,
      customerId: customer._id,
      serviceId: service._id,
      durationOverrideMinutes: 45,
    });

    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 10);
    start.setUTCHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const created = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        serviceId: otherService._id.toString(),
        customerId: customer._id.toString(),
        start: start.toISOString(),
        end: end.toISOString(),
      });
    expect(created.status).toBe(201);
    const appointmentId = created.body.appointmentId;

    // Reassign to the overridden service without an explicit end — the API should
    // recompute `end` using the 45-minute override, not the service's own 60-minute default.
    const patched = await request(app)
      .patch(`/api/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceId: service._id.toString() });

    expect(patched.status).toBe(200);
    const patchedStart = new Date(patched.body.start);
    const patchedEnd = new Date(patched.body.end);
    expect(patchedEnd.getTime() - patchedStart.getTime()).toBe(45 * 60 * 1000);
  });
});
