import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AuditLog } from '../models/AuditLog';
import { User } from '../models/User';
import { resolveDateRange, startOfBusinessDay } from '../listQuery/dateRange';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedSuperAdmin, signTestToken } from './helpers/seed';

const app = buildTestApp();
const ZONE = 'Asia/Jerusalem';

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

async function adminToken(): Promise<string> {
  const { token } = await seedSuperAdmin();
  return token;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function entry(overrides: Record<string, unknown> = {}) {
  return AuditLog.create({
    actorEmail: 'ada@test.com',
    action: 'customer.exported',
    entity: 'Customer',
    entityId: 'ent-1',
    metadata: {},
    createdAt: new Date('2024-06-01T12:00:00.000Z'),
    ...overrides,
  });
}

describe('GET /api/admin/audit', () => {
  it('keeps the existing page contract and newest-first order', async () => {
    const token = await adminToken();
    const older = await entry({
      action: 'user.update',
      entityId: 'old-1',
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    const newer = await entry({
      action: 'user.delete',
      entityId: 'new-1',
      createdAt: new Date('2024-06-02T00:00:00.000Z'),
    });

    const res = await request(app).get('/api/admin/audit?page=1&limit=10').set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(10);
    expect(res.body.items.length).toBe(2);
    expect(res.body.items[0].id).toBe(newer._id.toString());
    expect(res.body.items[1].id).toBe(older._id.toString());
    expect(res.body.items[0].actor).toBe('ada@test.com');
    expect(res.body.items[0].action).toBe('user.delete');
    expect(res.body.items[0].entity).toBe('Customer');
    expect(res.body.items[0].entityId).toBe('new-1');
    expect(res.body.items[0].metadata).toEqual({});
    expect(res.body.items[0].impersonatingSuperAdminId).toBeUndefined();
  });

  it('still filters a single action and entity, and searches actor, entity id, and action', async () => {
    const token = await adminToken();
    await entry({ actorEmail: 'ada@test.com', action: 'customer.exported', entity: 'Customer', entityId: 'find-me' });
    await entry({ actorEmail: 'bea@test.com', action: 'user.update', entity: 'User', entityId: 'other' });

    const byAction = await request(app).get('/api/admin/audit?action=customer.exported').set(auth(token));
    expect(byAction.status).toBe(200);
    expect(byAction.body.total).toBe(1);
    expect(byAction.body.items[0].action).toBe('customer.exported');

    const byEntity = await request(app).get('/api/admin/audit?entity=User').set(auth(token));
    expect(byEntity.body.total).toBe(1);
    expect(byEntity.body.items[0].entity).toBe('User');

    const byActor = await request(app).get('/api/admin/audit?search=bea@').set(auth(token));
    expect(byActor.body.total).toBe(1);
    expect(byActor.body.items[0].actor).toBe('bea@test.com');

    const byEntityId = await request(app).get('/api/admin/audit?search=find-me').set(auth(token));
    expect(byEntityId.body.items[0].entityId).toBe('find-me');

    const byActionText = await request(app).get('/api/admin/audit?search=user.update').set(auth(token));
    expect(byActionText.body.total).toBe(1);
    expect(byActionText.body.items[0].action).toBe('user.update');
  });

  it('filters today, last 7 days, last 30 days, and this month as half-open Jerusalem ranges', async () => {
    const token = await adminToken();
    const now = new Date();
    const today = resolveDateRange({ preset: 'today', timezone: ZONE, now });
    const last7 = resolveDateRange({ preset: 'last7Days', timezone: ZONE, now });
    const last30 = resolveDateRange({ preset: 'last30Days', timezone: ZONE, now });
    const month = resolveDateRange({ preset: 'thisMonth', timezone: ZONE, now });

    await entry({ action: 'inside.today', createdAt: today.start });
    await entry({ action: 'before.today', createdAt: new Date(today.start.getTime() - 1) });
    await entry({ action: 'at.today.end', createdAt: today.end });
    await entry({ action: 'inside.last7', createdAt: last7.start });
    await entry({ action: 'before.last7', createdAt: new Date(last7.start.getTime() - 1) });
    await entry({ action: 'inside.last30', createdAt: last30.start });
    await entry({ action: 'before.last30', createdAt: new Date(last30.start.getTime() - 1) });
    await entry({ action: 'inside.month', createdAt: month.start });
    await entry({ action: 'before.month', createdAt: new Date(month.start.getTime() - 1) });

    const todayRes = await request(app).get('/api/admin/audit?date=today').set(auth(token));
    const todayActions = todayRes.body.items.map((row: { action: string }) => row.action);
    expect(todayActions.includes('inside.today')).toBe(true);
    expect(todayActions.includes('before.today')).toBe(false);
    expect(todayActions.includes('at.today.end')).toBe(false);

    const last7Res = await request(app).get('/api/admin/audit?date=last7').set(auth(token));
    const last7Actions = last7Res.body.items.map((row: { action: string }) => row.action);
    expect(last7Actions.includes('inside.last7')).toBe(true);
    expect(last7Actions.includes('inside.today')).toBe(true);
    expect(last7Actions.includes('before.last7')).toBe(false);

    const last30Res = await request(app).get('/api/admin/audit?date=last30Days').set(auth(token));
    const last30Actions = last30Res.body.items.map((row: { action: string }) => row.action);
    expect(last30Actions.includes('inside.last30')).toBe(true);
    expect(last30Actions.includes('before.last30')).toBe(false);

    const monthRes = await request(app).get('/api/admin/audit?date=thisMonth').set(auth(token));
    const monthActions = monthRes.body.items.map((row: { action: string }) => row.action);
    expect(monthActions.includes('inside.month')).toBe(true);
    expect(monthActions.includes('before.month')).toBe(false);
  });

  it('filters a custom half-open range and an actor email or system', async () => {
    const token = await adminToken();
    const start = startOfBusinessDay('2024-03-01', ZONE);
    const end = startOfBusinessDay('2024-03-03', ZONE);
    await entry({ action: 'on.start', createdAt: start, actorEmail: 'ada@test.com' });
    await entry({ action: 'on.end', createdAt: end, actorEmail: 'ada@test.com' });
    await entry({ action: 'by.system', createdAt: new Date(start.getTime() + 1000), actorEmail: 'system' });
    await entry({ action: 'by.other', createdAt: new Date(start.getTime() + 2000), actorEmail: 'bea@test.com' });

    const custom = await request(app)
      .get('/api/admin/audit?date=custom&from=2024-03-01&to=2024-03-03')
      .set(auth(token));
    const customActions = custom.body.items.map((row: { action: string }) => row.action).sort();
    expect(customActions).toEqual(['by.other', 'by.system', 'on.start']);

    const fromTo = await request(app)
      .get('/api/admin/audit?from=2024-03-01&to=2024-03-03&actor=Ada@test.com')
      .set(auth(token));
    expect(fromTo.body.total).toBe(1);
    expect(fromTo.body.items[0].action).toBe('on.start');

    const system = await request(app).get('/api/admin/audit?actor=system').set(auth(token));
    expect(system.body.total).toBe(1);
    expect(system.body.items[0].actor).toBe('system');
    expect(system.body.items[0].action).toBe('by.system');
  });

  it('combines date, actor, multi-value action, entity, and search with AND', async () => {
    const token = await adminToken();
    const start = startOfBusinessDay('2024-04-10', ZONE);
    await entry({
      actorEmail: 'ada@test.com',
      action: 'customer.exported',
      entity: 'Customer',
      entityId: 'ada-row',
      createdAt: new Date(start.getTime() + 1000),
    });
    await entry({
      actorEmail: 'ada@test.com',
      action: 'user.update',
      entity: 'Customer',
      entityId: 'ada-row',
      createdAt: new Date(start.getTime() + 2000),
    });
    await entry({
      actorEmail: 'bea@test.com',
      action: 'customer.exported',
      entity: 'Customer',
      entityId: 'ada-row',
      createdAt: new Date(start.getTime() + 3000),
    });
    await entry({
      actorEmail: 'ada@test.com',
      action: 'customer.exported',
      entity: 'Service',
      entityId: 'ada-row',
      createdAt: new Date(start.getTime() + 4000),
    });

    const res = await request(app)
      .get(
        '/api/admin/audit?from=2024-04-10&to=2024-04-11&actor=ada@test.com&action=customer.exported,user.update&entity=Customer&search=ada-row'
      )
      .set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.map((row: { action: string }) => row.action).sort()).toEqual([
      'customer.exported',
      'user.update',
    ]);
  });

  it('sorts by timestamp, actor, and action, and rejects an unknown field', async () => {
    const token = await adminToken();
    await entry({ actorEmail: 'mira@test.com', action: 'user.update', createdAt: new Date('2024-01-02T00:00:00.000Z') });
    await entry({ actorEmail: 'ada@test.com', action: 'user.delete', createdAt: new Date('2024-01-03T00:00:00.000Z') });
    await entry({ actorEmail: 'zoe@test.com', action: 'business.provision', createdAt: new Date('2024-01-01T00:00:00.000Z') });

    const byActor = await request(app).get('/api/admin/audit?sort=actor&order=asc').set(auth(token));
    expect(byActor.body.items.map((row: { actor: string }) => row.actor)).toEqual([
      'ada@test.com',
      'mira@test.com',
      'zoe@test.com',
    ]);

    const byAction = await request(app).get('/api/admin/audit?sort=action&order=desc').set(auth(token));
    expect(byAction.body.items.map((row: { action: string }) => row.action)).toEqual([
      'user.update',
      'user.delete',
      'business.provision',
    ]);

    const byTime = await request(app).get('/api/admin/audit?sort=timestamp&order=asc').set(auth(token));
    expect(byTime.body.items.map((row: { action: string }) => row.action)).toEqual([
      'business.provision',
      'user.update',
      'user.delete',
    ]);

    const rejected = await request(app).get('/api/admin/audit?sort=metadata').set(auth(token));
    expect(rejected.status).toBe(400);
  });

  it('returns the impersonating super-admin id only when the record stored one', async () => {
    const token = await adminToken();
    await entry({
      action: 'business.ui_updated_while_impersonating',
      metadata: { impersonatingSuperAdminId: 'admin-77', businessId: 'biz-1' },
    });
    await entry({ action: 'user.update', metadata: { businessId: 'biz-1' } });

    const res = await request(app).get('/api/admin/audit?sort=action&order=asc').set(auth(token));
    const impersonated = res.body.items.find(
      (row: { action: string }) => row.action === 'business.ui_updated_while_impersonating'
    );
    const plain = res.body.items.find((row: { action: string }) => row.action === 'user.update');
    expect(impersonated.impersonatingSuperAdminId).toBe('admin-77');
    expect(plain.impersonatingSuperAdminId).toBeUndefined();
    expect(plain.metadata.businessId).toBe('biz-1');
  });

  it('allows only a super-admin and exposes no write route', async () => {
    const { token: ownerToken } = await seedOwner();
    const passwordHash = await bcrypt.hash('Staff123!', 4);
    const staff = await User.create({
      email: 'staff@test.com',
      passwordHash,
      role: 'staff',
      status: 'active',
    });
    const staffToken = signTestToken({
      userId: staff._id.toString(),
      role: 'staff',
      email: staff.email,
    });
    const { token } = await seedSuperAdmin();

    const owner = await request(app).get('/api/admin/audit').set(auth(ownerToken));
    const staffRes = await request(app).get('/api/admin/audit').set(auth(staffToken));
    expect(owner.status).toBe(403);
    expect(staffRes.status).toBe(403);

    const post = await request(app).post('/api/admin/audit').set(auth(token)).send({});
    const put = await request(app).put('/api/admin/audit').set(auth(token)).send({});
    const patch = await request(app).patch('/api/admin/audit').set(auth(token)).send({});
    const del = await request(app).delete('/api/admin/audit').set(auth(token));
    expect(post.status).toBe(404);
    expect(put.status).toBe(404);
    expect(patch.status).toBe(404);
    expect(del.status).toBe(404);
  });
});
