import request from 'supertest';
import { Types } from 'mongoose';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedBusinessSettings } from './helpers/seed';
import { BusinessSettings } from '../models/BusinessSettings';
import { BUSINESS_SETTINGS_DEFAULTS as D } from '../config/businessSettingsDefaults';
import { removeThemeAccentAndText } from '../services/settingsMigrations';

const app = buildTestApp();

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

async function rawColors(businessId: Types.ObjectId) {
  const doc = await BusinessSettings.collection.findOne({ businessId });
  return (doc?.theme as { colors?: Record<string, string> } | undefined)?.colors ?? {};
}

describe('THEME COLORS: accent and text are gone', () => {
  it('the model, the defaults and the API no longer know them', async () => {
    expect(Object.keys(D.theme.colors)).toEqual(['primary', 'secondary', 'background']);
    expect(BusinessSettings.schema.path('theme.colors.accent')).toBeUndefined();
    expect(BusinessSettings.schema.path('theme.colors.text')).toBeUndefined();
    expect(BusinessSettings.schema.path('theme.colors.primary')).toBeDefined();

    const { token } = await seedOwner();
    for (const colors of [{ accent: '#123456' }, { text: '#123456' }]) {
      const res = await request(app)
        .put('/api/settings/me/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ theme: { colors } });
      expect(res.status).toBe(400);
    }
  });

  it('a new business is created without them', async () => {
    const { business } = await seedOwner();
    await seedBusinessSettings(business._id);
    expect(Object.keys(await rawColors(business._id)).sort()).toEqual(['background', 'primary', 'secondary']);
  });

  it('the migration removes them from stored settings, leaves everything else, and can run twice', async () => {
    const withLegacy = new Types.ObjectId();
    const without = new Types.ObjectId();
    await BusinessSettings.collection.insertMany([
      {
        businessId: withLegacy,
        plan: 'free',
        theme: {
          colors: { primary: '#1D4ED8', secondary: '#F59E0B', accent: '#6CD6CD', background: '#F8FAFC', text: '#111827' },
          preset: 'custom',
          defaultMode: 'dark',
          logoUrl: '/uploads/logo.png',
          fontFamily: 'system-ui',
        },
        landingTagline: 'Keep me',
      },
      {
        businessId: without,
        plan: 'free',
        theme: { colors: { primary: '#F35271', secondary: '#FF9DBC', background: '#FFFFFF' }, preset: 'prime-pink' },
      },
    ]);

    const first = await removeThemeAccentAndText();
    expect(first).toEqual({ matched: 1, modified: 1 });

    expect(await rawColors(withLegacy)).toEqual({ primary: '#1D4ED8', secondary: '#F59E0B', background: '#F8FAFC' });
    const kept = await BusinessSettings.collection.findOne({ businessId: withLegacy });
    expect(kept?.landingTagline).toBe('Keep me');
    expect((kept?.theme as { preset: string; defaultMode: string; logoUrl: string }).preset).toBe('custom');
    expect((kept?.theme as { defaultMode: string }).defaultMode).toBe('dark');
    expect((kept?.theme as { logoUrl: string }).logoUrl).toBe('/uploads/logo.png');
    expect(await rawColors(without)).toEqual({ primary: '#F35271', secondary: '#FF9DBC', background: '#FFFFFF' });

    expect(await removeThemeAccentAndText()).toEqual({ matched: 0, modified: 0 });
  });

  it('the public payload of a migrated business carries only the three colors', async () => {
    const { business } = await seedOwner();
    await seedBusinessSettings(business._id);
    await BusinessSettings.collection.updateOne(
      { businessId: business._id },
      { $set: { 'theme.colors.accent': '#6CD6CD', 'theme.colors.text': '#111827' } }
    );
    await removeThemeAccentAndText();
    const res = await request(app).get(`/api/public/businesses/${business.slug}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.theme.colors).sort()).toEqual(['background', 'primary', 'secondary']);
  });
});
