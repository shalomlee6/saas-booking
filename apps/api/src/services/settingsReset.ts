import { createHash } from 'crypto';
import type { ClientSession } from 'mongoose';
import { Types } from 'mongoose';
import { BUSINESS_SETTINGS_DEFAULTS as D } from '../config/businessSettingsDefaults';
import { ConflictError, NotFoundError } from '../errors/httpErrors';
import { AuditLog } from '../models/AuditLog';
import { Business, type IBusiness } from '../models/Business';
import { BusinessSettings, type IBusinessSettings } from '../models/BusinessSettings';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { runInTransaction } from '../utils/runInTransaction';

/**
 * Factory reset covers SETTINGS ONLY. What each scope resets:
 *
 *   design       Business.ui (theme mode, colors, dashboard layout) and BusinessSettings.theme
 *                (colors, preset, default mode, font) — the logos are kept
 *   booking      onlineBooking and cancellationWindowHours
 *   reliability  noShowPolicy and reliability
 *   customers    birthdayField
 *   all          the four above
 *
 * Never touched: customers, appointments, services and prices, per-client overrides, excuse and booking
 * override records, the audit log, business name/slug/phone/address, working hours, landing page content,
 * logos and gallery, plan and features, localization, and the account.
 */
export const RESET_GROUPS = ['design', 'booking', 'reliability', 'customers'] as const;
export type ResetGroup = (typeof RESET_GROUPS)[number];
export const RESET_SCOPES = ['all', ...RESET_GROUPS] as const;
export type ResetScope = (typeof RESET_SCOPES)[number];

export function groupsForScope(scope: ResetScope): ResetGroup[] {
  return scope === 'all' ? [...RESET_GROUPS] : [scope];
}

export function isResetScope(value: unknown): value is ResetScope {
  return typeof value === 'string' && (RESET_SCOPES as readonly string[]).includes(value);
}

/** The JSON-safe values of the resettable settings, per group. This is what a snapshot stores. */
export interface SettingsState {
  design?: {
    ui: { themeMode: string; primaryColor: string; sidebarColor: string; backgroundColor: string; dashboardLayout: string };
    theme: {
      colors: { primary: string; secondary: string; accent: string; background: string; text: string };
      preset: string;
      defaultMode: string;
      fontFamily: string;
    };
  };
  booking?: {
    onlineBooking: {
      enabled: boolean;
      minLeadMinutes: number;
      maxAdvanceDays: number;
      bufferMinutes: number;
      onlineDefaultStatus: string;
      maxActiveAppointmentsPerClient: number | null;
      clientCanCancelOnline: boolean;
    };
    cancellationWindowHours: number;
  };
  reliability?: {
    noShowPolicy: { enabled: boolean; threshold: number };
    reliability: {
      lateCancellation: { enabled: boolean; threshold: number };
      lateArrival: { enabled: boolean; threshold: number };
      lookback: string;
    };
  };
  customers?: { birthdayField: string };
}

function counter(raw: { enabled?: boolean; threshold?: number } | null | undefined) {
  return { enabled: raw?.enabled as boolean, threshold: raw?.threshold as number };
}

/** Reads the current values. Mongoose has already applied schema defaults to missing fields. */
export function readState(groups: ResetGroup[], settings: IBusinessSettings, business: IBusiness): SettingsState {
  const state: SettingsState = {};
  for (const group of groups) {
    if (group === 'design') {
      const ui = business.ui;
      const theme = settings.theme;
      state.design = {
        ui: {
          themeMode: ui?.themeMode ?? D.ui.themeMode,
          primaryColor: ui?.primaryColor ?? D.ui.primaryColor,
          sidebarColor: ui?.sidebarColor ?? D.ui.sidebarColor,
          backgroundColor: ui?.backgroundColor ?? D.ui.backgroundColor,
          dashboardLayout: ui?.dashboardLayout ?? D.ui.dashboardLayout,
        },
        theme: {
          colors: {
            primary: theme?.colors?.primary ?? D.theme.colors.primary,
            secondary: theme?.colors?.secondary ?? D.theme.colors.secondary,
            accent: theme?.colors?.accent ?? D.theme.colors.accent,
            background: theme?.colors?.background ?? D.theme.colors.background,
            text: theme?.colors?.text ?? D.theme.colors.text,
          },
          preset: theme?.preset ?? D.theme.preset,
          defaultMode: theme?.defaultMode ?? D.theme.defaultMode,
          fontFamily: theme?.fontFamily ?? D.theme.fontFamily,
        },
      };
    } else if (group === 'booking') {
      const raw = settings.onlineBooking;
      state.booking = {
        onlineBooking: {
          enabled: raw?.enabled ?? D.onlineBooking.enabled,
          minLeadMinutes: raw?.minLeadMinutes ?? D.onlineBooking.minLeadMinutes,
          maxAdvanceDays: raw?.maxAdvanceDays ?? D.onlineBooking.maxAdvanceDays,
          bufferMinutes: raw?.bufferMinutes ?? D.onlineBooking.bufferMinutes,
          onlineDefaultStatus: raw?.onlineDefaultStatus ?? D.onlineBooking.onlineDefaultStatus,
          maxActiveAppointmentsPerClient: raw?.maxActiveAppointmentsPerClient ?? D.onlineBooking.maxActiveAppointmentsPerClient,
          clientCanCancelOnline: raw?.clientCanCancelOnline ?? D.onlineBooking.clientCanCancelOnline,
        },
        cancellationWindowHours: settings.cancellationWindowHours ?? D.cancellationWindowHours,
      };
    } else if (group === 'reliability') {
      state.reliability = {
        noShowPolicy: counter(settings.noShowPolicy ?? D.noShowPolicy),
        reliability: {
          lateCancellation: counter(settings.reliability?.lateCancellation ?? D.reliability.lateCancellation),
          lateArrival: counter(settings.reliability?.lateArrival ?? D.reliability.lateArrival),
          lookback: settings.reliability?.lookback ?? D.reliability.lookback,
        },
      };
    } else {
      state.customers = { birthdayField: settings.birthdayField ?? D.birthdayField };
    }
  }
  return state;
}

/** The factory values for the groups, copied so nobody can mutate the shared defaults. */
export function defaultState(groups: ResetGroup[]): SettingsState {
  const state: SettingsState = {};
  for (const group of groups) {
    if (group === 'design') {
      state.design = {
        ui: {
          themeMode: D.ui.themeMode,
          primaryColor: D.ui.primaryColor,
          sidebarColor: D.ui.sidebarColor,
          backgroundColor: D.ui.backgroundColor,
          dashboardLayout: D.ui.dashboardLayout,
        },
        theme: {
          colors: { ...D.theme.colors },
          preset: D.theme.preset,
          defaultMode: D.theme.defaultMode,
          fontFamily: D.theme.fontFamily,
        },
      };
    } else if (group === 'booking') {
      state.booking = {
        onlineBooking: { ...D.onlineBooking },
        cancellationWindowHours: D.cancellationWindowHours,
      };
    } else if (group === 'reliability') {
      state.reliability = {
        noShowPolicy: { ...D.noShowPolicy },
        reliability: {
          lateCancellation: { ...D.reliability.lateCancellation },
          lateArrival: { ...D.reliability.lateArrival },
          lookback: D.reliability.lookback,
        },
      };
    } else {
      state.customers = { birthdayField: D.birthdayField };
    }
  }
  return state;
}

export function fingerprintOf(state: SettingsState): string {
  return createHash('sha1').update(JSON.stringify(state)).digest('hex');
}

/** `$set` paths for BusinessSettings and Business. Logos are never in here. */
function toUpdates(state: SettingsState): { settings: Record<string, unknown>; business: Record<string, unknown> } {
  const settings: Record<string, unknown> = {};
  const business: Record<string, unknown> = {};
  if (state.design) {
    for (const [key, value] of Object.entries(state.design.ui)) business[`ui.${key}`] = value;
    for (const [key, value] of Object.entries(state.design.theme.colors)) settings[`theme.colors.${key}`] = value;
    settings['theme.preset'] = state.design.theme.preset;
    settings['theme.defaultMode'] = state.design.theme.defaultMode;
    settings['theme.fontFamily'] = state.design.theme.fontFamily;
  }
  if (state.booking) {
    settings.onlineBooking = state.booking.onlineBooking;
    settings.cancellationWindowHours = state.booking.cancellationWindowHours;
  }
  if (state.reliability) {
    settings.noShowPolicy = state.reliability.noShowPolicy;
    settings.reliability = state.reliability.reliability;
  }
  if (state.customers) settings.birthdayField = state.customers.birthdayField;
  return { settings, business };
}

async function applyState(
  businessId: Types.ObjectId,
  state: SettingsState,
  session: ClientSession | undefined
): Promise<void> {
  const updates = toUpdates(state);
  if (Object.keys(updates.settings).length > 0) {
    await BusinessSettings.updateOne({ businessId }, { $set: updates.settings }, { session });
  }
  if (Object.keys(updates.business).length > 0) {
    await Business.updateOne({ _id: businessId }, { $set: updates.business }, { session });
  }
}

async function loadDocs(
  businessId: Types.ObjectId,
  session: ClientSession | undefined
): Promise<{ settings: IBusinessSettings; business: IBusiness }> {
  const settings = await BusinessSettings.findOne({ businessId }).session(session ?? null);
  const business = await Business.findById(businessId).session(session ?? null);
  if (!settings || !business) throw new NotFoundError('Business not found');
  return { settings, business };
}

export interface SettingsActor {
  userId?: string;
  email?: string;
}

function auditEntry(actor: SettingsActor, action: string, settingsId: string, metadata: Record<string, unknown>) {
  return {
    actorUserId: actor.userId ? new Types.ObjectId(actor.userId) : undefined,
    actorEmail: actor.email,
    action,
    entity: 'BusinessSettings',
    entityId: settingsId,
    metadata,
    createdAt: new Date(),
  };
}

export interface ResetResult {
  scope: ResetScope;
  /** False when the settings already were the factory values: nothing was written and no snapshot is offered. */
  changed: boolean;
  restoreAvailable: boolean;
}

/** Resets the scope's settings to the factory values, one transaction: write, snapshot, audit. */
export async function resetSettings(input: {
  businessId: string;
  scope: ResetScope;
  actor: SettingsActor;
}): Promise<ResetResult> {
  const businessId = new Types.ObjectId(input.businessId);
  await ensureBusinessSettings(businessId);
  const groups = groupsForScope(input.scope);
  const next = defaultState(groups);

  return runInTransaction(async (session) => {
    const before = await loadDocs(businessId, session);
    const previous = readState(groups, before.settings, before.business);
    const changed = fingerprintOf(previous) !== fingerprintOf(next);

    const [audit] = await AuditLog.create(
      [
        auditEntry(input.actor, 'business.settings_reset', before.settings._id.toString(), {
          businessId: input.businessId,
          scope: input.scope,
          groups,
          changed,
          // The restore endpoint reads this back. It holds only the values the reset touched.
          snapshot: previous,
          after: next,
        }),
      ],
      { session }
    );
    if (!changed) return { scope: input.scope, changed: false, restoreAvailable: false };

    await applyState(businessId, next, session);
    const after = await loadDocs(businessId, session);
    await BusinessSettings.updateOne(
      { businessId },
      {
        $set: {
          resetUndo: {
            auditId: audit._id.toString(),
            scope: input.scope,
            fingerprint: fingerprintOf(readState(groups, after.settings, after.business)),
            at: new Date(),
          },
        },
      },
      { session }
    );
    return { scope: input.scope, changed: true, restoreAvailable: true };
  });
}

export interface ResetStatus {
  available: boolean;
  scope?: ResetScope;
  at?: Date;
}

/** The snapshot is offered until any of the values it covers changes. */
export async function getResetStatus(businessId: string): Promise<ResetStatus> {
  const id = new Types.ObjectId(businessId);
  await ensureBusinessSettings(id);
  const { settings, business } = await loadDocs(id, undefined);
  const undo = settings.resetUndo;
  if (!undo?.auditId || !isResetScope(undo.scope)) return { available: false };
  const current = readState(groupsForScope(undo.scope), settings, business);
  if (fingerprintOf(current) !== undo.fingerprint) return { available: false };
  return { available: true, scope: undo.scope, at: undo.at };
}

export interface RestoreResult {
  scope: ResetScope;
}

/** Puts the snapshot back, while nothing it covers has changed since the reset. One transaction. */
export async function restoreSettings(input: { businessId: string; actor: SettingsActor }): Promise<RestoreResult> {
  const businessId = new Types.ObjectId(input.businessId);
  await ensureBusinessSettings(businessId);

  return runInTransaction(async (session) => {
    const { settings, business } = await loadDocs(businessId, session);
    const undo = settings.resetUndo;
    if (!undo?.auditId || !isResetScope(undo.scope)) {
      throw new ConflictError('There is nothing to restore', 'NO_SNAPSHOT');
    }
    const groups = groupsForScope(undo.scope);
    const current = readState(groups, settings, business);
    if (fingerprintOf(current) !== undo.fingerprint) {
      throw new ConflictError('The settings changed after the reset, so the snapshot is out of date', 'SNAPSHOT_STALE');
    }
    const source = await AuditLog.findById(undo.auditId).session(session ?? null);
    const snapshot = source?.metadata?.snapshot as SettingsState | undefined;
    if (!source || !snapshot) throw new ConflictError('The snapshot is no longer available', 'NO_SNAPSHOT');

    await AuditLog.create(
      [
        auditEntry(input.actor, 'business.settings_restored', settings._id.toString(), {
          businessId: input.businessId,
          scope: undo.scope,
          groups,
          restoredFromAuditId: undo.auditId,
          before: current,
          after: snapshot,
        }),
      ],
      { session }
    );
    await applyState(businessId, snapshot, session);
    await BusinessSettings.updateOne({ businessId }, { $unset: { resetUndo: '' } }, { session });
    return { scope: undo.scope };
  });
}
