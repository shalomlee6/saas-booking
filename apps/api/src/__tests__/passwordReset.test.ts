import request from 'supertest';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedSuperAdmin } from './helpers/seed';
import { PasswordResetToken } from '../models/PasswordResetToken';
import {
  GENERIC_FORGOT_MESSAGE,
  hashResetToken,
  issuePasswordResetToken,
} from '../services/passwordResetService';

const app = buildTestApp();

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

describe('PASSWORD RESET', () => {
  it('forgot-password always returns the generic message for an unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(GENERIC_FORGOT_MESSAGE);
    expect(await PasswordResetToken.countDocuments()).toBe(0);
  });

  it('forgot-password stores a hashed token for an existing user', async () => {
    await seedOwner({ email: 'owner@test.com' });

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'owner@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(GENERIC_FORGOT_MESSAGE);
    expect(res.body.token).toBeUndefined();
    expect(await PasswordResetToken.countDocuments()).toBe(1);
  });

  it('reset-password rejects an invalid token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'a'.repeat(32), password: 'NewPass123!' });

    expect(res.status).toBe(400);
  });

  it('reset-password rejects an expired token', async () => {
    const { user } = await seedOwner({ email: 'owner@test.com' });
    const raw = await issuePasswordResetToken(user._id.toString());
    await PasswordResetToken.updateOne(
      { tokenHash: hashResetToken(raw) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: raw, password: 'NewPass123!' });

    expect(res.status).toBe(400);
  });

  it('reset-password updates the password and rejects token reuse', async () => {
    const { user } = await seedOwner({ email: 'owner@test.com', password: 'OldPass123!' });
    const raw = await issuePasswordResetToken(user._id.toString());

    const first = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: raw, password: 'NewPass123!' });
    expect(first.status).toBe(200);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'owner@test.com', password: 'NewPass123!' });
    expect(login.status).toBe(200);

    const reuse = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: raw, password: 'AnotherPass123!' });
    expect(reuse.status).toBe(400);
  });

  it('super-admin can trigger a reset email for a user', async () => {
    const { token } = await seedSuperAdmin();
    const { user } = await seedOwner({ email: 'owner@test.com' });

    const res = await request(app)
      .post(`/api/admin/users/${user._id.toString()}/reset-password`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(await PasswordResetToken.countDocuments({ userId: user._id })).toBe(1);
  });

  it('owner cannot trigger an admin password reset', async () => {
    const { token, user } = await seedOwner();

    const res = await request(app)
      .post(`/api/admin/users/${user._id.toString()}/reset-password`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
