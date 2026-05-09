import request from 'supertest';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedService, seedBusinessSettings } from './helpers/seed';

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
});
