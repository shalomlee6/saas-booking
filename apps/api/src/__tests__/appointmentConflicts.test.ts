import request from 'supertest';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedService, seedCustomer, seedBusinessSettings } from './helpers/seed';

const app = buildTestApp();

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

/** Returns a pair of future ISO timestamps that are always within the seeded all-day schedule. */
function futureSlot(daysFromNow = 7, hourUtc = 10): { start: string; end: string } {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  d.setUTCHours(hourUtc, 0, 0, 0);
  const start = d.toISOString();
  const end = new Date(d.getTime() + 60 * 60 * 1000).toISOString(); // +1 hour
  return { start, end };
}

describe('APPOINTMENT CONFLICTS', () => {
  it('creates the first appointment successfully', async () => {
    const { business, token } = await seedOwner();
    const service = await seedService(business._id);
    const customer = await seedCustomer(business._id);
    await seedBusinessSettings(business._id);

    const { start, end } = futureSlot();

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        serviceId: service._id.toString(),
        customerId: customer._id.toString(),
        start,
        end,
      });

    expect(res.status).toBe(201);
  });

  it('rejects a second booking that overlaps exactly the first', async () => {
    const { business, token } = await seedOwner();
    const service = await seedService(business._id);
    const customer = await seedCustomer(business._id);
    await seedBusinessSettings(business._id);

    const { start, end } = futureSlot();
    const payload = {
      serviceId: service._id.toString(),
      customerId: customer._id.toString(),
      start,
      end,
    };

    const r1 = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(r1.status).toBe(201);

    const r2 = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(r2.status).toBe(409);
  });

  it('rejects a partial overlap (second starts in the middle of first)', async () => {
    const { business, token } = await seedOwner();
    const service = await seedService(business._id);
    const customer = await seedCustomer(business._id);
    await seedBusinessSettings(business._id);

    const base = new Date();
    base.setUTCDate(base.getUTCDate() + 8);
    base.setUTCHours(10, 0, 0, 0);

    const first = {
      start: base.toISOString(),
      end: new Date(base.getTime() + 60 * 60 * 1000).toISOString(),
    };
    const overlap = {
      start: new Date(base.getTime() + 30 * 60 * 1000).toISOString(),
      end: new Date(base.getTime() + 90 * 60 * 1000).toISOString(),
    };

    const basePayload = {
      serviceId: service._id.toString(),
      customerId: customer._id.toString(),
    };

    const r1 = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...basePayload, ...first });

    expect(r1.status).toBe(201);

    const r2 = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...basePayload, ...overlap });

    expect(r2.status).toBe(409);
  });

  it('allows two non-overlapping back-to-back appointments', async () => {
    const { business, token } = await seedOwner();
    const service = await seedService(business._id);
    const customer = await seedCustomer(business._id);
    await seedBusinessSettings(business._id);

    const base = new Date();
    base.setUTCDate(base.getUTCDate() + 9);
    base.setUTCHours(10, 0, 0, 0);

    const slot1 = {
      start: base.toISOString(),
      end: new Date(base.getTime() + 60 * 60 * 1000).toISOString(),
    };
    const slot2 = {
      start: new Date(base.getTime() + 60 * 60 * 1000).toISOString(),
      end: new Date(base.getTime() + 120 * 60 * 1000).toISOString(),
    };

    const basePayload = {
      serviceId: service._id.toString(),
      customerId: customer._id.toString(),
    };

    const r1 = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...basePayload, ...slot1 });

    const r2 = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...basePayload, ...slot2 });

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
  });
});
