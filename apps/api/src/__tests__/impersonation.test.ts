import request from 'supertest';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedSuperAdmin } from './helpers/seed';

const app = buildTestApp();

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

/** Reads the freshly re-issued token off a response (see maybeRenewStaffSession). */
function refreshedToken(res: request.Response): string {
  const token = res.headers['x-refreshed-token'];
  if (!token) throw new Error('Expected X-Refreshed-Token header on response');
  return token;
}

describe('IMPERSONATION + PASSWORD CHANGE', () => {
  it('impersonation still works after the admin changed their own password', async () => {
    const { token: adminToken } = await seedSuperAdmin();
    const { business } = await seedOwner();

    const changeRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ currentPassword: 'Admin123!', newPassword: 'NewAdmin123!' });
    expect(changeRes.status).toBe(200);
    const freshAdminToken = refreshedToken(changeRes);

    // The OLD (pre-change) admin token must no longer be able to start a new
    // impersonation session — it predates the password change.
    const staleAttempt = await request(app)
      .post('/api/admin/impersonate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ businessId: business._id.toString() });
    expect(staleAttempt.status).toBe(401);
    expect(staleAttempt.body.message).toMatch(/password was changed/i);

    // The FRESH token (re-issued by change-password) can impersonate normally.
    const impersonateRes = await request(app)
      .post('/api/admin/impersonate')
      .set('Authorization', `Bearer ${freshAdminToken}`)
      .send({ businessId: business._id.toString() });
    expect(impersonateRes.status).toBe(200);
    const impersonationToken = impersonateRes.body.token as string;
    expect(impersonationToken).toBeTruthy();

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${impersonationToken}`);
    expect(me.status).toBe(200);
    expect(me.body.business?._id).toBe(business._id.toString());
  });

  it('impersonation still works after the impersonated owner changed their own password', async () => {
    const { token: adminToken } = await seedSuperAdmin();
    const { business, token: ownerToken } = await seedOwner();

    const ownerChangeRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ currentPassword: 'Password123!', newPassword: 'NewOwnerPass123!' });
    expect(ownerChangeRes.status).toBe(200);

    // The admin's own (untouched) token can still start impersonating this
    // business — the owner's password change must not affect the admin's session.
    const impersonateRes = await request(app)
      .post('/api/admin/impersonate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ businessId: business._id.toString() });
    expect(impersonateRes.status).toBe(200);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${impersonateRes.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.business?._id).toBe(business._id.toString());
    expect(me.body.user.email).toMatch(/superadmin/i);
  });

  it('exiting impersonation does not require the admin to log in again', async () => {
    const { token: adminToken } = await seedSuperAdmin();
    const { business } = await seedOwner();

    const impersonateRes = await request(app)
      .post('/api/admin/impersonate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ businessId: business._id.toString() });
    expect(impersonateRes.status).toBe(200);

    const stopRes = await request(app)
      .post('/api/admin/stop-impersonate')
      .set('Authorization', `Bearer ${impersonateRes.body.token}`);
    expect(stopRes.status).toBe(200);

    // The admin's original session token (never touched by impersonation) is
    // still good — no re-login needed after exiting.
    const meAfterExit = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(meAfterExit.status).toBe(200);
    expect(meAfterExit.body.user.role).toBe('super_admin');
  });

  it('a token issued before a password change is rejected afterwards, on any route', async () => {
    const { token: ownerToken } = await seedOwner();

    const beforeChange = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(beforeChange.status).toBe(200);

    const changeRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ currentPassword: 'Password123!', newPassword: 'AnotherNewPass123!' });
    expect(changeRes.status).toBe(200);

    const afterChange = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(afterChange.status).toBe(401);
    expect(afterChange.body.message).toMatch(/password was changed/i);

    const freshToken = refreshedToken(changeRes);
    const withFreshToken = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${freshToken}`);
    expect(withFreshToken.status).toBe(200);
  });
});
