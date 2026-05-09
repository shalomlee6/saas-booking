import request from 'supertest';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedSuperAdmin } from './helpers/seed';

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

  it('unauthenticated request to admin routes returns 401', async () => {
    const analyticsRes = await request(app).get('/api/admin/analytics');
    const usersRes = await request(app).get('/api/admin/users');

    expect(analyticsRes.status).toBe(401);
    expect(usersRes.status).toBe(401);
  });
});
