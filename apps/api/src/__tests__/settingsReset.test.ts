import request from 'supertest';
import bcrypt from 'bcryptjs';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedService, seedBusinessSettings, seedCustomer, seedSuperAdmin, signTestToken } from './helpers/seed';
import { Appointment } from '../models/Appointment';
import { AuditLog } from '../models/AuditLog';
import { Business } from '../models/Business';
import { BusinessSettings } from '../models/BusinessSettings';
import { Customer } from '../models/Customer';
import { CustomerServiceConfig } from '../models/CustomerServiceConfig';
import { Service } from '../models/Service';
import { User } from '../models/User';
import { BUSINESS_SETTINGS_DEFAULTS as D } from '../config/businessSettingsDefaults';
import { resolveOnlineBookingRules } from '../services/bookingRules';
import { resolveReliabilityPolicy } from '../services/customerNoShows';
import {
  RESET_GROUPS,
  defaultState,
  getResetStatus,
  readState,
  type ResetGroup,
  type SettingsState,
} from '../services/settingsReset';

const app = buildTestApp();

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

/** Values that differ from the factory defaults in every group a reset touches. */
const CUSTOM_SETTINGS = {
  'theme.colors.primary': '#112233',
  'theme.colors.secondary': '#223344',
  'theme.colors.accent': '#334455',
  'theme.colors.background': '#445566',
  'theme.colors.text': '#556677',
  'theme.preset': 'prime-mint',
  'theme.defaultMode': 'dark',
  'theme.fontFamily': 'Arial',
  onlineBooking: {
    enabled: false,
    minLeadMinutes: 120,
    maxAdvanceDays: 30,
    bufferMinutes: 10,
    onlineDefaultStatus: 'pending',
    maxActiveAppointmentsPerClient: 2,
    clientCanCancelOnline: false,
  },
  cancellationWindowHours: 48,
  noShowPolicy: { enabled: false, threshold: 5 },
  reliability: {
    lateCancellation: { enabled: true, threshold: 2 },
    lateArrival: { enabled: true, threshold: 4 },
    lookback: 'all',
  },
  birthdayField: 'hidden',
};

/** Things a reset must never change. */
const KEPT_SETTINGS = {
  'theme.logoUrl': '/uploads/keep/theme-logo.png',
  bookingWelcomeMessage: 'Welcome in',
  landingTagline: 'Best nails in town',
  coverImageUrl: '/uploads/keep/cover.jpg',
  landingSecondaryHeroImageUrl: '/uploads/keep/second.jpg',
  landingHeroDescription: 'Hero copy',
  portfolioImages: ['/uploads/keep/p1.jpg'],
  landingProducts: [{ name: 'Gel polish', price: 40 }],
  landingGalleryItems: [{ id: 'g1', imageUrl: '/uploads/keep/g1.jpg', title: 'One', type: 'service' }],
  landingContact: { whatsapp: '0501112222', email: 'hi@keep.test', location: 'Dizengoff 1' },
  landingServiceOrder: ['a', 'b'],
  landingSectionVisibility: { hero: false, gallery: true },
  publicRating: 4,
  businessPhonePublic: '0509998888',
  plan: 'premium',
  features: {
    bookingEnabled: true,
    paymentsEnabled: true,
    marketingModule: true,
    chatModule: true,
    waitlistEnabled: true,
    analyticsEnabled: true,
    customDomainEnabled: true,
  },
  localization: { language: 'en', timezone: 'Europe/London', currency: 'USD' },
  openingHours: {
    slotStepMinutes: 15,
    days: [{ day: 1, isOpen: true, ranges: [{ start: '10:00', end: '12:00' }] }],
  },
};

const CUSTOM_UI = {
  'ui.themeMode': 'dark',
  'ui.primaryColor': '#0A0B0C',
  'ui.sidebarColor': '#0D0E0F',
  'ui.backgroundColor': '#101112',
  'ui.dashboardLayout': 'compact',
};

async function setup() {
  const { business, token, user } = await seedOwner();
  await seedBusinessSettings(business._id);
  const service = await seedService(business._id);
  const customer = await seedCustomer(business._id);
  const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  await Appointment.create({
    businessId: business._id,
    customerId: customer._id,
    serviceId: service._id,
    start,
    end: new Date(start.getTime() + 60 * 60 * 1000),
    status: 'confirmed',
    source: 'owner',
    price: 100,
  });
  await CustomerServiceConfig.create({
    businessId: business._id,
    customerId: customer._id,
    serviceId: service._id,
    priceOverride: 55,
    durationOverrideMinutes: 20,
  });
  await BusinessSettings.updateOne({ businessId: business._id }, { $set: { ...CUSTOM_SETTINGS, ...KEPT_SETTINGS } });
  await Business.updateOne(
    { _id: business._id },
    {
      $set: {
        ...CUSTOM_UI,
        'ui.logoUrl': '/uploads/keep/ui-logo.png',
        name: 'Keep This Name',
        phone: '0501234567',
        address: 'Rothschild 9',
      },
    }
  );
  return { business, token, user, service, customer };
}

function resetAll(token: string, confirm = 'איפוס') {
  return request(app)
    .post('/api/settings/me/reset')
    .set('Authorization', `Bearer ${token}`)
    .send({ scope: 'all', confirm });
}

function resetSection(token: string, scope: ResetGroup) {
  return request(app).post('/api/settings/me/reset').set('Authorization', `Bearer ${token}`).send({ scope });
}

async function load(businessId: unknown) {
  const settings = await BusinessSettings.findOne({ businessId });
  const business = await Business.findById(businessId);
  return { settings: settings!, business: business! };
}

async function stateOf(businessId: unknown, groups: ResetGroup[] = [...RESET_GROUPS]): Promise<SettingsState> {
  const { settings, business } = await load(businessId);
  return readState(groups, settings, business);
}

/** Everything the reset must leave alone, read back as plain JSON. */
async function keptSnapshot(businessId: unknown) {
  const { settings, business } = await load(businessId);
  const raw = settings.toObject() as unknown as Record<string, unknown>;
  const keptSettings: Record<string, unknown> = {};
  for (const key of [
    'bookingWelcomeMessage',
    'landingTagline',
    'coverImageUrl',
    'landingSecondaryHeroImageUrl',
    'landingHeroDescription',
    'portfolioImages',
    'landingProducts',
    'landingGalleryItems',
    'landingContact',
    'landingServiceOrder',
    'landingSectionVisibility',
    'publicRating',
    'businessPhonePublic',
    'plan',
    'features',
    'localization',
    'openingHours',
  ]) {
    keptSettings[key] = raw[key];
  }
  return JSON.parse(
    JSON.stringify({
      keptSettings,
      themeLogo: (raw.theme as { logoUrl?: string }).logoUrl,
      uiLogo: business.ui?.logoUrl,
      business: { name: business.name, slug: business.slug, phone: business.phone, address: business.address, plan: business.plan },
    })
  );
}

/** Customers, appointments, services, per-client overrides: whole documents. */
async function dataSnapshot(businessId: unknown) {
  return JSON.parse(
    JSON.stringify({
      customers: await Customer.find({ businessId }).lean(),
      appointments: await Appointment.find({ businessId }).lean(),
      services: await Service.find({ businessId }).lean(),
      overrides: await CustomerServiceConfig.find({ businessId }).lean(),
    })
  );
}

describe('FACTORY RESET', () => {
  it('uses one defaults object for the models and for reset', async () => {
    const { business } = await seedOwner();
    const fresh = new BusinessSettings({ businessId: business._id });
    const freshBusiness = new Business({ ownerId: business.ownerId, name: 'x', slug: 'fresh-defaults' });
    expect(readState([...RESET_GROUPS], fresh, freshBusiness)).toEqual(defaultState([...RESET_GROUPS]));
    expect(fresh.features.bookingEnabled).toBe(D.features.bookingEnabled);
    expect(fresh.localization.timezone).toBe(D.localization.timezone);
    expect(fresh.publicRating).toBe(D.landing.publicRating);
    expect(freshBusiness.ui?.logoUrl).toBe(D.ui.logoUrl);
  });

  it('a full reset restores the exact defaults', async () => {
    const { business, token } = await setup();
    expect(await stateOf(business._id)).not.toEqual(defaultState([...RESET_GROUPS]));

    const res = await resetAll(token);
    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(true);
    expect(res.body.status.available).toBe(true);

    expect(await stateOf(business._id)).toEqual(defaultState([...RESET_GROUPS]));
    const { settings, business: reloaded } = await load(business._id);
    expect(resolveOnlineBookingRules(settings)).toEqual({
      ...D.onlineBooking,
      cancellationWindowHours: D.cancellationWindowHours,
    });
    expect(resolveReliabilityPolicy(settings)).toEqual({
      noShow: D.noShowPolicy,
      lateCancellation: D.reliability.lateCancellation,
      lateArrival: D.reliability.lateArrival,
      lookback: D.reliability.lookback,
    });
    expect(settings.birthdayField).toBe(D.birthdayField);
    expect(reloaded.ui?.primaryColor).toBe(D.ui.primaryColor);
    expect(settings.theme.colors.primary).toBe(D.theme.colors.primary);

    const rules = await request(app).get('/api/settings/me/booking-rules').set('Authorization', `Bearer ${token}`);
    expect(rules.body.booking.minLeadMinutes).toBe(D.onlineBooking.minLeadMinutes);
    expect(rules.body.booking.cancellationWindowHours).toBe(D.cancellationWindowHours);
  });

  it('never touches data, content, logos, hours, business details or the audit history', async () => {
    const { business, token } = await setup();
    const keptBefore = await keptSnapshot(business._id);
    const dataBefore = await dataSnapshot(business._id);
    await AuditLog.create({ action: 'customer.created', entity: 'Customer', entityId: 'c1', metadata: { keep: true } });
    const auditBefore = JSON.parse(JSON.stringify(await AuditLog.find({}).lean()));

    expect((await resetAll(token)).status).toBe(200);

    expect(await keptSnapshot(business._id)).toEqual(keptBefore);
    expect(await dataSnapshot(business._id)).toEqual(dataBefore);
    const auditAfter = JSON.parse(JSON.stringify(await AuditLog.find({ action: { $ne: 'business.settings_reset' } }).lean()));
    expect(auditAfter).toEqual(auditBefore);
    // The uploaded logo and gallery are still there, and the keep list did not get defaults.
    expect(keptBefore.themeLogo).toBe('/uploads/keep/theme-logo.png');
    expect(keptBefore.uiLogo).toBe('/uploads/keep/ui-logo.png');
  });

  it('resets one section and leaves every other section as it was', async () => {
    for (const group of RESET_GROUPS) {
      await dbClear();
      const { business, token } = await setup();
      const before = await stateOf(business._id);
      const keptBefore = await keptSnapshot(business._id);
      const dataBefore = await dataSnapshot(business._id);

      const res = await resetSection(token, group);
      expect(res.status).toBe(200);
      expect(res.body.scope).toBe(group);

      const after = await stateOf(business._id);
      for (const other of RESET_GROUPS) {
        if (other === group) expect(after[other]).toEqual(defaultState([other])[other]);
        else expect(after[other]).toEqual(before[other]);
      }
      expect(await keptSnapshot(business._id)).toEqual(keptBefore);
      expect(await dataSnapshot(business._id)).toEqual(dataBefore);
    }
  });

  it('asks a full reset to be confirmed with the typed word', async () => {
    const { business, token } = await setup();
    const before = await stateOf(business._id);

    const missing = await request(app)
      .post('/api/settings/me/reset')
      .set('Authorization', `Bearer ${token}`)
      .send({ scope: 'all' });
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe('CONFIRMATION_REQUIRED');
    expect((await resetAll(token, 'yes')).status).toBe(400);
    expect(await stateOf(business._id)).toEqual(before);
    expect(await AuditLog.countDocuments({ action: 'business.settings_reset' })).toBe(0);

    expect((await resetAll(token, ' RESET ')).status).toBe(200);
    expect(await stateOf(business._id)).toEqual(defaultState([...RESET_GROUPS]));
  });

  it('stores the previous settings in the audit entry', async () => {
    const { business, token, user } = await setup();
    const before = await stateOf(business._id);
    await resetAll(token);

    const entry = await AuditLog.findOne({ action: 'business.settings_reset' });
    expect(entry?.actorEmail).toBe(user.email);
    expect(entry?.entityId).toBe((await load(business._id)).settings._id.toString());
    expect(entry?.metadata?.scope).toBe('all');
    expect(entry?.metadata?.snapshot).toEqual(before);
    expect(entry?.metadata?.after).toEqual(defaultState([...RESET_GROUPS]));
  });

  it('restores the snapshot, audits it, and offers it only once', async () => {
    const { business, token, user } = await setup();
    const before = await stateOf(business._id);
    const keptBefore = await keptSnapshot(business._id);
    await resetAll(token);

    const status = await request(app).get('/api/settings/me/reset/status').set('Authorization', `Bearer ${token}`);
    expect(status.body.available).toBe(true);
    expect(status.body.scope).toBe('all');

    const restored = await request(app).post('/api/settings/me/reset/restore').set('Authorization', `Bearer ${token}`);
    expect(restored.status).toBe(200);
    expect(restored.body.status.available).toBe(false);
    expect(await stateOf(business._id)).toEqual(before);
    expect(await keptSnapshot(business._id)).toEqual(keptBefore);

    const audit = await AuditLog.findOne({ action: 'business.settings_restored' });
    expect(audit?.actorEmail).toBe(user.email);
    expect(audit?.metadata?.after).toEqual(before);
    expect(audit?.metadata?.restoredFromAuditId).toBe(
      (await AuditLog.findOne({ action: 'business.settings_reset' }))?._id.toString()
    );

    const again = await request(app).post('/api/settings/me/reset/restore').set('Authorization', `Bearer ${token}`);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('NO_SNAPSHOT');
  });

  it('restores a section reset, and only until a setting it covers changes', async () => {
    const { business, token } = await setup();
    const before = await stateOf(business._id);
    await resetSection(token, 'booking');

    // Changing something the snapshot does not cover keeps it available.
    await request(app)
      .put('/api/customers/birthday-field')
      .set('Authorization', `Bearer ${token}`)
      .send({ birthdayField: 'optional' });
    const stillOffered = await getResetStatus(business._id.toString());
    expect(stillOffered.available).toBe(true);
    expect(stillOffered.scope).toBe('booking');

    // Changing a covered setting retires it.
    const save = await request(app)
      .put('/api/settings/me/booking-rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...D.onlineBooking, cancellationWindowHours: D.cancellationWindowHours, bufferMinutes: 15 });
    expect(save.status).toBe(200);
    expect((await getResetStatus(business._id.toString())).available).toBe(false);

    const stale = await request(app).post('/api/settings/me/reset/restore').set('Authorization', `Bearer ${token}`);
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('SNAPSHOT_STALE');
    const after = await stateOf(business._id);
    expect(after.booking?.onlineBooking.bufferMinutes).toBe(15);
    expect(after.booking).not.toEqual(before.booking);
  });

  it('refuses a restore when the settings changed behind its back', async () => {
    const { business, token } = await setup();
    await resetSection(token, 'reliability');
    // A change that bypasses the status check, as a race would.
    await BusinessSettings.updateOne({ businessId: business._id }, { $set: { 'noShowPolicy.threshold': 9 } });
    const res = await request(app).post('/api/settings/me/reset/restore').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SNAPSHOT_STALE');
    expect((await stateOf(business._id, ['reliability'])).reliability?.noShowPolicy.threshold).toBe(9);
  });

  it('is for the owner only', async () => {
    const { business, token } = await setup();
    const before = await stateOf(business._id);
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
    const { token: adminToken } = await seedSuperAdmin();

    await resetAll(token); // so there is a snapshot to (not) restore
    const afterOwnerReset = await stateOf(business._id);
    expect(afterOwnerReset).not.toEqual(before);

    for (const denied of [staffToken, adminToken]) {
      const reset = await resetAll(denied);
      expect(reset.status).toBeGreaterThanOrEqual(400);
      const section = await resetSection(denied, 'design');
      expect(section.status).toBeGreaterThanOrEqual(400);
      const status = await request(app).get('/api/settings/me/reset/status').set('Authorization', `Bearer ${denied}`);
      expect(status.status).toBeGreaterThanOrEqual(400);
      const restore = await request(app).post('/api/settings/me/reset/restore').set('Authorization', `Bearer ${denied}`);
      expect(restore.status).toBeGreaterThanOrEqual(400);
    }
    expect((await resetAll(staffToken)).status).toBe(403);
    expect(await stateOf(business._id)).toEqual(afterOwnerReset);

    const anonymous = await request(app).post('/api/settings/me/reset').send({ scope: 'design' });
    expect(anonymous.status).toBe(401);
  });

  it('does not offer a snapshot when nothing changed', async () => {
    const { business, token } = await setup();
    await resetAll(token);
    const second = await resetAll(token);
    expect(second.status).toBe(200);
    expect(second.body.changed).toBe(false);
    // The first reset's snapshot is still the one that can be restored.
    expect((await getResetStatus(business._id.toString())).available).toBe(true);
  });
});
