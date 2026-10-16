import request from 'supertest';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedService, seedSuperAdmin } from './helpers/seed';
import { Appointment } from '../models/Appointment';

const app = buildTestApp();

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

describe('ADMIN ANALYTICS', () => {
  it('super-admin can access GET /api/admin/analytics', async () => {
    const { token } = await seedSuperAdmin();

    const res = await request(app)
      .get('/api/admin/analytics')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('super-admin can access GET /api/admin/overview', async () => {
    const { token } = await seedSuperAdmin();

    const res = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('regular owner is denied GET /api/admin/analytics with 403', async () => {
    const { token } = await seedOwner();

    const res = await request(app)
      .get('/api/admin/analytics')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('regular owner is denied GET /api/admin/users with 403', async () => {
    const { token } = await seedOwner();

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('counts only completed appointments as revenue', async () => {
    const { token } = await seedSuperAdmin();
    const { business } = await seedOwner();
    const service = await seedService(business._id);
    const start = new Date(Date.now() - 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const base = {
      businessId: business._id,
      serviceId: service._id,
      start,
      end,
      source: 'owner' as const,
    };
    await Appointment.create({ ...base, status: 'completed', price: 80 });
    await Appointment.create({ ...base, status: 'pending', price: 40 });
    await Appointment.create({ ...base, status: 'confirmed', price: 30 });
    await Appointment.create({ ...base, status: 'cancelled', price: 20 });
    await Appointment.create({ ...base, status: 'no_show', price: 10 });

    const analytics = await request(app)
      .get('/api/admin/analytics')
      .set('Authorization', `Bearer ${token}`);
    expect(analytics.status).toBe(200);
    expect(analytics.body.totals.revenueInRange).toBe(80);
    expect(analytics.body.totals.totalRevenue).toBe(80);
    expect(analytics.body.totals.revenueLast30Days).toBe(80);
    const dayAmounts = (analytics.body.charts.revenueByDay as { amount: number }[]).map((day) => day.amount);
    expect(dayAmounts.reduce((sum, amount) => sum + amount, 0)).toBe(80);

    const overview = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${token}`);
    expect(overview.status).toBe(200);
    expect(overview.body.totalRevenue).toBe(80);
  });

  it('unauthenticated request to admin routes returns 401', async () => {
    const analyticsRes = await request(app).get('/api/admin/analytics');
    const usersRes = await request(app).get('/api/admin/users');

    expect(analyticsRes.status).toBe(401);
    expect(usersRes.status).toBe(401);
  });
});
