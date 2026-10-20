import request from 'supertest';
import bcrypt from 'bcryptjs';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedBusinessSettings, seedSuperAdmin, signTestToken } from './helpers/seed';
import { AuditLog } from '../models/AuditLog';
import { Business } from '../models/Business';
import { BusinessSettings } from '../models/BusinessSettings';
import { User } from '../models/User';
import { BUSINESS_SETTINGS_DEFAULTS as D } from '../config/businessSettingsDefaults';

const app = buildTestApp();

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

const CUSTOM = {
  preset: 'custom',
  defaultMode: 'dark',
  colors: { primary: '#1D4ED8', secondary: '#F59E0B', background: '#F8FAFC' },
};

async function setup() {
  const { business, token, user } = await seedOwner();
  await seedBusinessSettings(business._id);
  return { business, token, user };
}

function putTheme(token: string, body: unknown) {
  return request(app).put('/api/settings/me/public-theme').set('Authorization', `Bearer ${token}`).send(body as object);
}

async function publicTheme(slug: string) {
  const res = await request(app).get(`/api/public/businesses/${slug}`);
  expect(res.status).toBe(200);
  return res.body.theme as { preset: string; defaultMode: string; colors: Record<string, string> };
}

describe('PUBLIC CLIENT-SITE THEME', () => {
  it('stores the custom theme and the public site gets it in the business payload at once', async () => {
    const { business, token } = await setup();
    const res = await putTheme(token, CUSTOM);
    expect(res.status).toBe(200);
    expect(res.body.publicTheme).toEqual({
      preset: 'custom',
      defaultMode: 'dark',
      colors: { primary: '#1D4ED8', secondary: '#F59E0B', background: '#F8FAFC' },
    });

    const theme = await publicTheme(business.slug);
    expect(theme.preset).toBe('custom');
    expect(theme.defaultMode).toBe('dark');
    expect(theme.colors.primary).toBe('#1D4ED8');
    expect(theme.colors.secondary).toBe('#F59E0B');
    expect(theme.colors.background).toBe('#F8FAFC');
  });

  it('keeps unrelated fields when only some are sent, and normalizes hex to upper case', async () => {
    const { business, token } = await setup();
    await putTheme(token, CUSTOM);
    const res = await putTheme(token, { colors: { primary: '#0a0b0c' } });
    expect(res.status).toBe(200);
    const theme = await publicTheme(business.slug);
    expect(theme.colors.primary).toBe('#0A0B0C');
    expect(theme.colors.secondary).toBe('#F59E0B');
    expect(theme.preset).toBe('custom');
    expect(theme.defaultMode).toBe('dark');
  });

  it('rejects bad input without changing anything', async () => {
    const { business, token } = await setup();
    const before = await publicTheme(business.slug);
    for (const body of [
      {},
      { preset: 'neon' },
      { defaultMode: 'sepia' },
      { colors: { primary: 'red' } },
      { colors: { primary: '#12345' } },
      { colors: { accent: '#123456' } },
      { unknown: true },
    ]) {
      const res = await putTheme(token, body);
      if (res.status !== 400) throw new Error('expected 400 for ' + JSON.stringify(body) + ', got ' + res.status);
    }
    expect(await publicTheme(business.slug)).toEqual(before);
  });

  it('is owner-only', async () => {
    const { business, token } = await setup();
    const staff = await User.create({
      email: 'staff@test.com',
      passwordHash: await bcrypt.hash('Password123!', 4),
      role: 'staff',
      status: 'active',
      businessId: business._id,
    });
    const staffToken = signTestToken({
      userId: staff._id.toString(),
      role: 'staff',
      email: staff.email,
      businessId: business._id.toString(),
    });
    const before = await publicTheme(business.slug);
    expect((await putTheme(staffToken, CUSTOM)).status).toBe(403);
    expect((await request(app).put('/api/settings/me/public-theme').send(CUSTOM)).status).toBe(401);
    expect(await publicTheme(business.slug)).toEqual(before);
    expect((await putTheme(token, CUSTOM)).status).toBe(200);
  });

  it('audits a change with before and after, and nothing when nothing changed', async () => {
    const { business, token, user } = await setup();
    await putTheme(token, CUSTOM);
    const entries = await AuditLog.find({ action: 'business.public_theme_updated' });
    expect(entries.length).toBe(1);
    expect(entries[0].actorEmail).toBe(user.email);
    expect(entries[0].metadata?.businessId).toBe(business._id.toString());
    expect((entries[0].metadata?.before as { preset: string }).preset).toBe(D.theme.preset);
    expect((entries[0].metadata?.after as { preset: string }).preset).toBe('custom');

    await putTheme(token, CUSTOM);
    expect(await AuditLog.countDocuments({ action: 'business.public_theme_updated' })).toBe(1);
  });

  it('is one object: the super-admin form and the owner read and write the same theme', async () => {
    const { business, token } = await setup();
    const { token: adminToken } = await seedSuperAdmin();

    // Owner writes, super-admin sees it.
    await putTheme(token, CUSTOM);
    const listed = await request(app).get('/api/admin/businesses').set('Authorization', `Bearer ${adminToken}`);
    const row = (listed.body as { _id: string; settings: { theme: Record<string, unknown> } }[]).find(
      (item) => item._id === business._id.toString()
    );
    expect(row?.settings.theme.preset).toBe('custom');
    expect(row?.settings.theme.defaultMode).toBe('dark');
    expect((row?.settings.theme.colors as Record<string, string>).secondary).toBe('#F59E0B');

    // Super-admin writes through the same validation, the owner and the public site see it.
    const patched = await request(app)
      .patch(`/api/admin/businesses/${business._id.toString()}/ui`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ publicTheme: { preset: 'prime-mint', defaultMode: 'light', colors: { background: '#EEEEEE' } } });
    expect(patched.status).toBe(200);
    expect(patched.body.publicTheme).toEqual({
      preset: 'prime-mint',
      defaultMode: 'light',
      colors: { primary: '#1D4ED8', secondary: '#F59E0B', background: '#EEEEEE' },
    });
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.businessSettings.theme.preset).toBe('prime-mint');
    expect(me.body.businessSettings.theme.colors.background).toBe('#EEEEEE');
    expect((await publicTheme(business.slug)).preset).toBe('prime-mint');
    // And it was audited, as the super-admin.
    const audit = await AuditLog.find({ action: 'business.public_theme_updated' }).sort({ createdAt: -1 });
    expect(audit[0].metadata?.by).toBe('super_admin');

    // The admin form validates exactly like the owner's.
    const bad = await request(app)
      .patch(`/api/admin/businesses/${business._id.toString()}/ui`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ publicTheme: { preset: 'neon' } });
    expect(bad.status).toBe(400);
    const badColor = await request(app)
      .patch(`/api/admin/businesses/${business._id.toString()}/ui`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ publicTheme: { colors: { primary: 'blue' } } });
    expect(badColor.status).toBe(400);
  });

  it('a factory reset puts the public theme back to Prime Pink, light, and restore brings the custom one back', async () => {
    const { business, token } = await setup();
    await putTheme(token, CUSTOM);

    const reset = await request(app)
      .post('/api/settings/me/reset')
      .set('Authorization', `Bearer ${token}`)
      .send({ scope: 'all', confirm: 'reset' });
    expect(reset.status).toBe(200);
    const afterReset = await publicTheme(business.slug);
    expect(afterReset.preset).toBe(D.theme.preset);
    expect(afterReset.defaultMode).toBe(D.theme.defaultMode);
    expect(afterReset.colors.primary).toBe(D.theme.colors.primary);
    expect(afterReset.colors.secondary).toBe(D.theme.colors.secondary);
    expect(afterReset.colors.background).toBe(D.theme.colors.background);
    expect(D.theme.preset).toBe('prime-pink');
    expect(D.theme.defaultMode).toBe('light');

    const restored = await request(app)
      .post('/api/settings/me/reset/restore')
      .set('Authorization', `Bearer ${token}`);
    expect(restored.status).toBe(200);
    const theme = await publicTheme(business.slug);
    expect(theme.preset).toBe('custom');
    expect(theme.colors.primary).toBe('#1D4ED8');
  });

  it('sends the shared defaults with /auth/me so the app keeps no copy of its own', async () => {
    const { token } = await setup();
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.settingsDefaults).toEqual(JSON.parse(JSON.stringify(D)));
    expect(me.body.settingsDefaults.ui.primaryColor).toBe('#3787F6');
    const settings = await BusinessSettings.findOne({});
    expect(settings?.theme.preset).toBe(D.theme.preset);
    expect((await Business.findOne({}))?.ui?.primaryColor).toBe(D.ui.primaryColor);
  });
});
