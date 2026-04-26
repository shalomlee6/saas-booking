import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Business } from '../models/Business';
import { Appointment } from '../models/Appointment';
import { BusinessSettings } from '../models/BusinessSettings';
import { PlatformSettings } from '../models/PlatformSettings';
import { recordAudit } from '../utils/recordAudit';
import { logger } from '../utils/logger';

export type AdminAlertSeverity = 'info' | 'warning' | 'error';

export interface AdminAlertDto {
  id: string;
  severity: AdminAlertSeverity;
  category: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

async function getOrCreatePlatformSettings() {
  let doc = await PlatformSettings.findOne().sort({ createdAt: 1 });
  if (!doc) {
    doc = await PlatformSettings.create({});
  }
  return doc;
}

async function collectAlerts(): Promise<AdminAlertDto[]> {
  const platform = await getOrCreatePlatformSettings();
  const dismissed = new Set(
    Array.isArray(platform.adminAlertDismissedIds) ? platform.adminAlertDismissedIds : []
  );
  const resolved = new Set(
    Array.isArray(platform.adminAlertResolvedIds) ? platform.adminAlertResolvedIds : []
  );
  const hidden = (id: string) => dismissed.has(id) || resolved.has(id);

  const items: AdminAlertDto[] = [];
  const now = new Date();
  const trialDays = platform.defaultTrialDurationDays ?? 14;

  const disabledOwners = await User.find({ role: 'owner', status: 'disabled' })
    .select('email name')
    .lean();
  for (const u of disabledOwners) {
    const id = `owner-disabled-${u._id}`;
    if (hidden(id)) continue;
    items.push({
      id,
      severity: 'warning',
      category: 'accounts',
      title: 'Disabled owner account',
      message: `Owner ${u.email} is disabled and cannot access the dashboard.`,
      metadata: { userId: u._id.toString(), email: u.email },
      createdAt: now.toISOString(),
    });
  }

  const businesses = await Business.find().lean();
  const settingsRows = await BusinessSettings.find().lean();
  const settingsByBiz = new Map(settingsRows.map((s) => [s.businessId.toString(), s]));

  for (const b of businesses) {
    const s = settingsByBiz.get(b._id.toString());
    const plan = s?.plan ?? 'free';
    if (plan === 'free') {
      const created = new Date(b.createdAt).getTime();
      const trialEndMs = created + trialDays * 86400000;
      const daysLeft = (trialEndMs - now.getTime()) / 86400000;
      if (daysLeft > 0 && daysLeft <= 7) {
        const id = `trial-expiring-${b._id}`;
        if (hidden(id)) continue;
        items.push({
          id,
          severity: daysLeft <= 3 ? 'error' : 'warning',
          category: 'billing',
          title: 'Trial ending soon',
          message: `${b.name} (${b.slug}) trial ends in about ${Math.ceil(daysLeft)} day(s).`,
          metadata: { businessId: b._id.toString(), slug: b.slug },
          createdAt: now.toISOString(),
        });
      }
    }

  }

  const paymentsEnabledCount = settingsRows.filter((s) => s.features?.paymentsEnabled).length;
  if (paymentsEnabledCount > 0) {
    const id = 'payments-health-summary';
    if (!hidden(id)) {
      items.push({
        id,
        severity: 'info',
        category: 'payments',
        title: 'Payment activity',
        message: `${paymentsEnabledCount} business(es) have online payments enabled — monitor your PSP for failed charges.`,
        metadata: { count: paymentsEnabledCount },
        createdAt: now.toISOString(),
      });
    }
  }

  const inactiveCutoff = new Date(now.getTime() - 30 * 86400000);
  for (const b of businesses) {
    const lastAppt = await Appointment.findOne({
      businessId: b._id,
      status: { $nin: ['cancelled'] },
    })
      .sort({ start: -1 })
      .select('start')
      .lean();
    const lastStart = lastAppt?.start ? new Date(lastAppt.start) : null;
    if (!lastStart || lastStart < inactiveCutoff) {
      const id = `inactive-business-${b._id}`;
      if (hidden(id)) continue;
      items.push({
        id,
        severity: 'warning',
        category: 'engagement',
        title: 'Inactive business (30+ days)',
        message: lastStart
          ? `${b.name} has had no appointments since ${lastStart.toISOString().slice(0, 10)}.`
          : `${b.name} has no completed appointments on record.`,
        metadata: { businessId: b._id.toString(), slug: b.slug },
        createdAt: now.toISOString(),
      });
    }
  }

  items.sort((a, b) => {
    const rank = { error: 0, warning: 1, info: 2 };
    return rank[a.severity] - rank[b.severity] || a.title.localeCompare(b.title);
  });

  return items;
}

export async function getAdminAlerts(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const items = await collectAlerts();
    res.json({ items, activeCount: items.length });
  } catch (err) {
    logger.error('get_admin_alerts_failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getAdminAlertsCount(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const items = await collectAlerts();
    res.json({ count: items.length });
  } catch (err) {
    logger.error('get_admin_alerts_count_failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function dismissAdminAlert(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ message: 'Alert id required' });
      return;
    }
    const doc = await getOrCreatePlatformSettings();
    const list = new Set(doc.adminAlertDismissedIds ?? []);
    list.add(id);
    doc.adminAlertDismissedIds = [...list];
    await doc.save();

    await recordAudit({
      actorUserId: req.user?.userId,
      actorEmail: req.user?.email,
      action: 'admin_alert.dismiss',
      entity: 'SystemAlert',
      entityId: id,
      metadata: {},
    });

    const items = await collectAlerts();
    res.json({ ok: true, activeCount: items.length });
  } catch (err) {
    logger.error('dismiss_admin_alert_failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function resolveAdminAlert(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ message: 'Alert id required' });
      return;
    }
    const doc = await getOrCreatePlatformSettings();
    const list = new Set(doc.adminAlertResolvedIds ?? []);
    list.add(id);
    doc.adminAlertResolvedIds = [...list];
    await doc.save();

    await recordAudit({
      actorUserId: req.user?.userId,
      actorEmail: req.user?.email,
      action: 'admin_alert.resolve',
      entity: 'SystemAlert',
      entityId: id,
      metadata: {},
    });

    const items = await collectAlerts();
    res.json({ ok: true, activeCount: items.length });
  } catch (err) {
    logger.error('resolve_admin_alert_failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ message: 'Internal server error' });
  }
}
