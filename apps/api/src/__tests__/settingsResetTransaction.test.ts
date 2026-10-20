import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { AuditLog } from '../models/AuditLog';
import { Business } from '../models/Business';
import { BusinessSettings } from '../models/BusinessSettings';
import {
  RESET_GROUPS,
  defaultState,
  readState,
  resetSettings,
  restoreSettings,
} from '../services/settingsReset';

/**
 * Reset and restore write several documents (settings, business, audit entry, snapshot marker).
 * They must commit together or not at all, which only a replica set can enforce, so this file
 * runs against a single-node replica set instead of the standalone server the other tests use.
 */
let replSet: MongoMemoryReplSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  // Collections must exist before a transaction touches them.
  await Promise.all([Business.createCollection(), BusinessSettings.createCollection(), AuditLog.createCollection()]);
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

afterEach(async () => {
  jest.restoreAllMocks();
  await Promise.all([Business.deleteMany({}), BusinessSettings.deleteMany({}), AuditLog.deleteMany({})]);
});

async function seedCustomized() {
  const businessId = new Types.ObjectId();
  await Business.create({
    _id: businessId,
    ownerId: new Types.ObjectId(),
    name: 'Txn Salon',
    slug: `txn-${businessId.toString()}`,
    ui: { themeMode: 'dark', primaryColor: '#0A0B0C', sidebarColor: '#0D0E0F', backgroundColor: '#101112', dashboardLayout: 'compact', logoUrl: '/uploads/keep.png' },
  });
  await BusinessSettings.create({
    businessId,
    theme: { colors: { primary: '#112233' }, preset: 'prime-mint', defaultMode: 'dark', fontFamily: 'Arial', logoUrl: '/uploads/keep-theme.png' },
    onlineBooking: { enabled: false, minLeadMinutes: 120, bufferMinutes: 10 },
    cancellationWindowHours: 48,
    noShowPolicy: { enabled: false, threshold: 5 },
    birthdayField: 'hidden',
  });
  return businessId;
}

async function stateOf(businessId: Types.ObjectId) {
  const settings = await BusinessSettings.findOne({ businessId });
  const business = await Business.findById(businessId);
  return readState([...RESET_GROUPS], settings!, business!);
}

const actor = { email: 'owner@test.com' };

async function expectFailure(work: Promise<unknown>, message: string): Promise<void> {
  let caught: unknown;
  try {
    await work;
  } catch (error) {
    caught = error;
  }
  expect(caught instanceof Error ? caught.message : String(caught)).toBe(message);
}

describe('FACTORY RESET TRANSACTION', () => {
  it('commits the reset, the snapshot marker and the audit entry together', async () => {
    const businessId = await seedCustomized();
    const before = await stateOf(businessId);

    const result = await resetSettings({ businessId: businessId.toString(), scope: 'all', actor });
    expect(result.changed).toBe(true);
    expect(result.restoreAvailable).toBe(true);

    expect(await stateOf(businessId)).toEqual(defaultState([...RESET_GROUPS]));
    const settings = await BusinessSettings.findOne({ businessId });
    expect(settings?.resetUndo?.scope).toBe('all');
    const audit = await AuditLog.findOne({ action: 'business.settings_reset' });
    expect(audit?.metadata?.snapshot).toEqual(before);
    expect(settings?.resetUndo?.auditId).toBe(audit?._id.toString());
    // The logos belong to the part a reset keeps.
    expect(settings?.theme.logoUrl).toBe('/uploads/keep-theme.png');
    expect((await Business.findById(businessId))?.ui?.logoUrl).toBe('/uploads/keep.png');
  });

  it('rolls everything back when a later write of the reset fails', async () => {
    const businessId = await seedCustomized();
    const before = await stateOf(businessId);
    jest.spyOn(Business, 'updateOne').mockImplementationOnce(() => {
      throw new Error('boom');
    });

    await expectFailure(resetSettings({ businessId: businessId.toString(), scope: 'all', actor }), 'boom');

    // The settings write happened first inside the transaction. It must not have survived.
    expect(await stateOf(businessId)).toEqual(before);
    expect((await BusinessSettings.findOne({ businessId }))?.resetUndo?.auditId).toBeUndefined();
    expect(await AuditLog.countDocuments({})).toBe(0);
  });

  it('rolls a restore back when it fails part way', async () => {
    const businessId = await seedCustomized();
    const before = await stateOf(businessId);
    await resetSettings({ businessId: businessId.toString(), scope: 'all', actor });
    const afterReset = await stateOf(businessId);
    jest.spyOn(Business, 'updateOne').mockImplementationOnce(() => {
      throw new Error('boom');
    });

    await expectFailure(restoreSettings({ businessId: businessId.toString(), actor }), 'boom');

    expect(await stateOf(businessId)).toEqual(afterReset);
    expect((await BusinessSettings.findOne({ businessId }))?.resetUndo?.auditId).toBeTruthy();
    expect(await AuditLog.countDocuments({ action: 'business.settings_restored' })).toBe(0);

    // And once the fault is gone the same snapshot still restores cleanly.
    await restoreSettings({ businessId: businessId.toString(), actor });
    expect(await stateOf(businessId)).toEqual(before);
    expect(await AuditLog.countDocuments({ action: 'business.settings_restored' })).toBe(1);
  });
});
