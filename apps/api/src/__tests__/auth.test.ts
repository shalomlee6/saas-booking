import request from 'supertest';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner } from './helpers/seed';

const app = buildTestApp();

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

describe('AUTH', () => {
  it('registers a new user and returns token + business', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'newuser@test.com', password: 'Password123!' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('newuser@test.com');
    expect(res.body.user.role).toBe('owner');
    expect(res.body.business).toBeDefined();
  });

  it('rejects a duplicate email on register', async () => {
    await seedOwner({ email: 'dup@test.com' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@test.com', password: 'Password123!' });

    expect(res.status).toBe(409);
  });

  it('rejects a missing password on register', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'nopass@test.com' });

    expect(res.status).toBe(400);
  });

  it('logs in with valid credentials', async () => {
    await seedOwner({ email: 'owner@test.com', password: 'Secret456!' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'owner@test.com', password: 'Secret456!' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('owner');
  });

  it('rejects an invalid password', async () => {
    await seedOwner({ email: 'owner@test.com', password: 'Correct123!' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'owner@test.com', password: 'WrongPassword!' });

    expect(res.status).toBe(401);
  });

  it('rejects an unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'Password123!' });

    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me returns user with a valid Bearer token', async () => {
    const { token } = await seedOwner();

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBeDefined();
    expect(res.body.role).toBe('owner');
  });
});
