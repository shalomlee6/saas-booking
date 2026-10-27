import request from 'supertest';
import { createHash } from 'crypto';
import { Types } from 'mongoose';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedBusinessSettings, seedSuperAdmin } from './helpers/seed';
import { AuditLog } from '../models/AuditLog';
import { BusinessSettings } from '../models/BusinessSettings';
import { defaultState } from '../services/settingsReset';

/**
 * Settings documents written before `theme.colors.accent` and `theme.colors.text` were removed still carry
 * them. Nothing may fail or send them back because of that, so the cleanup migration stays optional.
 */

const app = buildTestApp();

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

const LEGACY = { accent: '#6CD6CD', text: '#111827' };
const CUSTOM_THEME = {
  preset: 'custom',
  defaultMode: 'dark',
  colors: { primary: '#1D4ED8', secondary: '#F59E0B', background: '#F8FAFC' },
};

async function legacySetup() {
  const { business, token, user } = await seedOwner();
  await seedBusinessSettings(business._id);
  await BusinessSettings.collection.updateOne(
    { businessId: business._id },
    { $set: { 'theme.colors.accent': LEGACY.accent, 'theme.colors.text': LEGACY.text } }
  );
  return { business, token, user };
}

async function rawColors(businessId: Types.ObjectId): Promise<Record<string, string>> {
  const doc = await BusinessSettings.collection.findOne({ businessId });
  return (doc?.theme as { colors?: Record<string, string> } | undefined)?.colors ?? {};
}

function keysOf(colors: Record<string, unknown>): string[] {
  return Object.keys(colors).sort();
}

const THREE = ['background', 'primary', 'secondary'];

describe('LEGACY THEME FIELDS (accent/text still stored): every save path keeps working', () => {
  it('the fixture really has the legacy fields in storage', async () => {
    const { business } = await legacySetup();
    expect(keysOf(await rawColors(business._id))).toEqual(['accent', 'background', 'primary', 'secondary', 'text']);
  });

  it('reads never send them out: settings, /auth/me, the public payload and the super-admin list', async () => {
    const { business, token } = await legacySetup();
    const { token: adminToken } = await seedSuperAdmin();

    const settings = await request(app).get('/api/settings/me/settings').set('Authorization', `Bearer ${token}`);
    expect(settings.status).toBe(200);
    expect(keysOf(settings.body.theme.colors)).toEqual(THREE);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(keysOf(me.body.businessSettings.theme.colors)).toEqual(THREE);

    const publicBusiness = await request(app).get(`/api/public/businesses/${business.slug}`);
    expect(publicBusiness.status).toBe(200);
    expect(keysOf(publicBusiness.body.theme.colors)).toEqual(THREE);

    const listed = await request(app).get('/api/admin/businesses').set('Authorization', `Bearer ${adminToken}`);
    expect(listed.status).toBe(200);
    const row = (listed.body as { _id: string; settings: { theme: { colors: Record<string, string> } } }[]).find(
      (item) => item._id === business._id.toString()
    );
    expect(keysOf(row?.settings.theme.colors ?? {})).toEqual(THREE);
  });

  it('owner design tab: saving exactly what the page loaded works, and so does a plain change', async () => {
    const { business, token } = await legacySetup();
    const loaded = await request(app).get('/api/settings/me/settings').set('Authorization', `Bearer ${token}`);

    // The page sends back what it was given.
    const sameBack = await request(app)
      .put('/api/settings/me/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: { colors: loaded.body.theme.colors, fontFamily: loaded.body.theme.fontFamily } });
    expect(sameBack.status).toBe(200);
    expect(keysOf(sameBack.body.theme.colors)).toEqual(THREE);

    const changed = await request(app)
      .put('/api/settings/me/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: { colors: { primary: '#0A0B0C' } } });
    expect(changed.status).toBe(200);
    expect(changed.body.theme.colors.primary).toBe('#0A0B0C');
    expect(keysOf(changed.body.theme.colors)).toEqual(THREE);

    const other = await request(app)
      .put('/api/settings/me/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ localization: { currency: 'ILS' } });
    expect(other.status).toBe(200);
    expect(keysOf(await rawColors(business._id)).includes('primary')).toBe(true);
  });

  it('owner public-theme tab: saves, and the public site gets exactly the three colors', async () => {
    const { business, token } = await legacySetup();
    const saved = await request(app)
      .put('/api/settings/me/public-theme')
      .set('Authorization', `Bearer ${token}`)
      .send(CUSTOM_THEME);
    expect(saved.status).toBe(200);
    expect(saved.body.publicTheme).toEqual(CUSTOM_THEME);

    const colorsOnly = await request(app)
      .put('/api/settings/me/public-theme')
      .set('Authorization', `Bearer ${token}`)
      .send({ colors: { secondary: '#112233' } });
    expect(colorsOnly.status).toBe(200);

    const publicBusiness = await request(app).get(`/api/public/businesses/${business.slug}`);
    expect(publicBusiness.body.theme.colors).toEqual({ primary: '#1D4ED8', secondary: '#112233', background: '#F8FAFC' });
  });

  it('super-admin form: saves the public theme and the admin colors in one request', async () => {
    const { business } = await legacySetup();
    const { token: adminToken } = await seedSuperAdmin();
    const res = await request(app)
      .patch(`/api/admin/businesses/${business._id.toString()}/ui`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ primaryColor: '#3787F6', publicTheme: CUSTOM_THEME });
    expect(res.status).toBe(200);

    const publicBusiness = await request(app).get(`/api/public/businesses/${business.slug}`);
    expect(publicBusiness.body.theme.colors).toEqual(CUSTOM_THEME.colors);
    expect(publicBusiness.body.theme.preset).toBe('custom');
  });

  it('factory reset and restore (design section and everything) work and never write the legacy fields', async () => {
    for (const scope of ['design', 'all'] as const) {
      await dbClear();
      const { business, token } = await legacySetup();
      await request(app)
        .put('/api/settings/me/public-theme')
        .set('Authorization', `Bearer ${token}`)
        .send(CUSTOM_THEME)
        .expect(200);

      const reset = await request(app)
        .post('/api/settings/me/reset')
        .set('Authorization', `Bearer ${token}`)
        .send(scope === 'all' ? { scope, confirm: 'איפוס' } : { scope });
      expect(reset.status).toBe(200);
      expect(reset.body.changed).toBe(true);
      const afterReset = await BusinessSettings.findOne({ businessId: business._id });
      expect(afterReset?.theme.preset).toBe('prime-pink');
      expect(afterReset?.theme.colors.primary).toBe('#F35271');

      const status = await request(app).get('/api/settings/me/reset/status').set('Authorization', `Bearer ${token}`);
      expect(status.body.available).toBe(true);

      const restored = await request(app).post('/api/settings/me/reset/restore').set('Authorization', `Bearer ${token}`);
      expect(restored.status).toBe(200);
      const afterRestore = await BusinessSettings.findOne({ businessId: business._id });
      expect(afterRestore?.theme.preset).toBe('custom');
      expect(afterRestore?.theme.colors.primary).toBe('#1D4ED8');
      expect(afterRestore?.theme.colors.secondary).toBe('#F59E0B');
    }
  });

  it('an undo offered before the removal is refused as out of date, cleanly, and changes nothing', async () => {
    const { business, token } = await legacySetup();
    await request(app)
      .put('/api/settings/me/public-theme')
      .set('Authorization', `Bearer ${token}`)
      .send(CUSTOM_THEME)
      .expect(200);
    await request(app)
      .post('/api/settings/me/reset')
      .set('Authorization', `Bearer ${token}`)
      .send({ scope: 'design' })
      .expect(200);

    // Rewrite the stored undo the way the previous release wrote it: five colors in snapshot and fingerprint.
    const settings = await BusinessSettings.findOne({ businessId: business._id });
    const audit = await AuditLog.findById(settings?.resetUndo?.auditId);
    const withLegacy = (state: ReturnType<typeof defaultState>) => {
      const design = state.design!;
      const { primary, secondary, background } = design.theme.colors;
      return {
        ...state,
        design: {
          ...design,
          theme: { ...design.theme, colors: { primary, secondary, accent: LEGACY.accent, background, text: LEGACY.text } },
        },
      };
    };
    const metadata = audit?.metadata as { snapshot: ReturnType<typeof defaultState>; after: ReturnType<typeof defaultState> };
    await AuditLog.collection.updateOne(
      { _id: audit?._id },
      { $set: { 'metadata.snapshot': withLegacy(metadata.snapshot), 'metadata.after': withLegacy(metadata.after) } }
    );
    const legacyFingerprint = createHash('sha1').update(JSON.stringify(withLegacy(metadata.after))).digest('hex');
    await BusinessSettings.updateOne({ businessId: business._id }, { $set: { 'resetUndo.fingerprint': legacyFingerprint } });

    // The fingerprint covered five colors; today's state has three, so the window is closed. Only an undo that was
    // open at the moment of the deploy is affected, and the existing 409 is what the page already handles.
    const status = await request(app).get('/api/settings/me/reset/status').set('Authorization', `Bearer ${token}`);
    expect(status.status).toBe(200);
    expect(status.body.available).toBe(false);
    const restored = await request(app).post('/api/settings/me/reset/restore').set('Authorization', `Bearer ${token}`);
    expect(restored.status).toBe(409);
    expect(restored.body.code).toBe('SNAPSHOT_STALE');
    const after = await BusinessSettings.findOne({ businessId: business._id });
    expect(after?.theme.preset).toBe('prime-pink');
  });
});
