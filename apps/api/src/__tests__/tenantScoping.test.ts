import request from 'supertest';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedCustomer, seedService, seedBusinessSettings } from './helpers/seed';

const app = buildTestApp();

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

describe('TENANT SCOPING', () => {
  it("owner cannot see another business's customers", async () => {
    const biz1 = await seedOwner({ email: 'biz1@test.com' });
    const biz2 = await seedOwner({ email: 'biz2@test.com' });

    await seedCustomer(biz2.business._id);

    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${biz1.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it("owner cannot see another business's appointments", async () => {
    const biz1 = await seedOwner({ email: 'biz1@test.com' });
    const biz2 = await seedOwner({ email: 'biz2@test.com' });

    await seedService(biz2.business._id);

    const res = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${biz1.token}`);

    expect(res.status).toBe(200);
    const items: unknown[] = Array.isArray(res.body) ? res.body : res.body.data ?? [];
    expect(items.length).toBe(0);
  });

  it("owner cannot see another business's services", async () => {
    const biz1 = await seedOwner({ email: 'biz1@test.com' });
    const biz2 = await seedOwner({ email: 'biz2@test.com' });

    await seedService(biz2.business._id);

    const res = await request(app)
      .get('/api/services')
      .set('Authorization', `Bearer ${biz1.token}`);

    expect(res.status).toBe(200);
    const items: unknown[] = Array.isArray(res.body) ? res.body : res.body.data ?? [];
    expect(items.length).toBe(0);
  });

  it('owner sees only their own customers', async () => {
    const biz1 = await seedOwner({ email: 'biz1@test.com' });
    const biz2 = await seedOwner({ email: 'biz2@test.com' });

    await seedCustomer(biz1.business._id);
    await seedCustomer(biz2.business._id);

    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${biz1.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
  });

  it('unauthenticated request to tenant routes returns 401', async () => {
    const customersRes = await request(app).get('/api/customers');
    const servicesRes = await request(app).get('/api/services');
    const appointmentsRes = await request(app).get('/api/appointments');

    expect(customersRes.status).toBe(401);
    expect(servicesRes.status).toBe(401);
    expect(appointmentsRes.status).toBe(401);
  });
});
