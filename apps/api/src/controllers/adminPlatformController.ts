import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Business } from '../models/Business';
import { Appointment } from '../models/Appointment';
import { BusinessSettings } from '../models/BusinessSettings';
import { PlatformSettings } from '../models/PlatformSettings';
import { AuditLog } from '../models/AuditLog';
import { recordAudit } from '../utils/recordAudit';

const USER_ROLES = ['super_admin', 'owner', 'staff', 'client'] as const;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getOrCreatePlatformSettings() {
  let doc = await PlatformSettings.findOne().sort({ createdAt: 1 });
  if (!doc) {
    doc = await PlatformSettings.create({});
  }
  return doc;
}

function parseRangeDays(range: string | undefined): number {
  if (range === '90d') return 90;
  if (range === '30d') return 30;
  return 7;
}

/** Estimated MRR per plan when billing integration is not present (USD). */
const PLAN_MRR_USD: Record<string, number> = {
  free: 0,
  normal: 49,
  premium: 99,
};

// GET /api/admin/users
export async function getAdminUsers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const role = String(req.query.role || '').trim();
    const status = String(req.query.status || '').trim();
    const businessId = String(req.query.businessId || '').trim();

    const filter: Record<string, unknown> = {};
    if (role && USER_ROLES.includes(role as (typeof USER_ROLES)[number])) {
      filter.role = role;
    }
    if (status === 'active' || status === 'disabled') {
      filter.status = status;
    }
    if (businessId && Types.ObjectId.isValid(businessId)) {
      filter.businessId = new Types.ObjectId(businessId);
    }
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ email: rx }, { name: rx }];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const businessIds = [
      ...new Set(
        users
          .map((u) => u.businessId?.toString())
          .filter((id): id is string => !!id)
      ),
    ];
    const businesses =
      businessIds.length > 0
        ? await Business.find({ _id: { $in: businessIds } })
            .select('name')
            .lean()
        : [];
    const businessNameById = new Map(
      businesses.map((b) => [b._id.toString(), b.name as string])
    );

    const items = users.map((u) => ({
      id: u._id.toString(),
      email: u.email,
      name: (u as { name?: string }).name?.trim() || '',
      role: u.role,
      status: (u as { status?: string }).status || 'active',
      businessId: u.businessId?.toString() ?? null,
      businessName: u.businessId ? businessNameById.get(u.businessId.toString()) ?? null : null,
      createdAt: u.createdAt,
      lastLoginAt: (u as { lastLoginAt?: Date }).lastLoginAt ?? null,
    }));

    res.json({ items, total, page, limit });
  } catch (err) {
    console.error('Error GET /admin/users:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/admin/users/:id
export async function getAdminUserById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid user id' });
      return;
    }
    const u = await User.findById(id).lean();
    if (!u) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    let businessName: string | null = null;
    if (u.businessId) {
      const b = await Business.findById(u.businessId).select('name').lean();
      businessName = b?.name ?? null;
    }
    res.json({
      id: u._id.toString(),
      email: u.email,
      name: (u as { name?: string }).name?.trim() || '',
      role: u.role,
      status: (u as { status?: string }).status || 'active',
      businessId: u.businessId?.toString() ?? null,
      businessName,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      lastLoginAt: (u as { lastLoginAt?: Date }).lastLoginAt ?? null,
    });
  } catch (err) {
    console.error('Error GET /admin/users/:id:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PATCH /api/admin/users/:id
export async function patchAdminUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid user id' });
      return;
    }
    const body = req.body as { status?: string; name?: string };
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    if (user.role === 'super_admin' && body.status === 'disabled') {
      res.status(400).json({ message: 'Cannot disable a super admin' });
      return;
    }
    if (body.status === 'active' || body.status === 'disabled') {
      user.status = body.status;
    }
    if (typeof body.name === 'string') {
      user.name = body.name.trim().slice(0, 200);
    }
    await user.save();

    await recordAudit({
      actorUserId: req.user?.userId,
      actorEmail: req.user?.email,
      action: 'user.update',
      entity: 'User',
      entityId: id,
      metadata: { status: user.status, name: user.name },
    });

    res.json({
      id: user._id.toString(),
      email: user.email,
      name: user.name ?? '',
      role: user.role,
      status: user.status,
      businessId: user.businessId?.toString() ?? null,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt ?? null,
    });
  } catch (err) {
    console.error('Error PATCH /admin/users/:id:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/admin/settings
export async function getAdminSettings(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const doc = await getOrCreatePlatformSettings();
    res.json({
      defaultTrialDurationDays: doc.defaultTrialDurationDays,
      maintenanceMode: doc.maintenanceMode,
      featureFlags: doc.featureFlags && typeof doc.featureFlags === 'object' ? doc.featureFlags : {},
      platformDisplayName: doc.platformDisplayName,
      emailConfigurationNote: doc.emailConfigurationNote,
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    console.error('Error GET /admin/settings:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PATCH /api/admin/settings
export async function patchAdminSettings(req: AuthRequest, res: Response): Promise<void> {
  try {
    const body = req.body as {
      defaultTrialDurationDays?: number;
      maintenanceMode?: boolean;
      featureFlags?: Record<string, boolean>;
      platformDisplayName?: string;
    };
    const doc = await getOrCreatePlatformSettings();
    if (typeof body.defaultTrialDurationDays === 'number') {
      doc.defaultTrialDurationDays = Math.max(0, Math.min(3650, body.defaultTrialDurationDays));
    }
    if (typeof body.maintenanceMode === 'boolean') {
      doc.maintenanceMode = body.maintenanceMode;
    }
    if (body.featureFlags && typeof body.featureFlags === 'object') {
      doc.featureFlags = body.featureFlags;
    }
    if (typeof body.platformDisplayName === 'string') {
      doc.platformDisplayName = body.platformDisplayName.trim().slice(0, 120);
    }
    await doc.save();

    await recordAudit({
      actorUserId: req.user?.userId,
      actorEmail: req.user?.email,
      action: 'platform_settings.update',
      entity: 'PlatformSettings',
      entityId: doc._id.toString(),
      metadata: {
        maintenanceMode: doc.maintenanceMode,
        defaultTrialDurationDays: doc.defaultTrialDurationDays,
      },
    });

    res.json({
      defaultTrialDurationDays: doc.defaultTrialDurationDays,
      maintenanceMode: doc.maintenanceMode,
      featureFlags: doc.featureFlags,
      platformDisplayName: doc.platformDisplayName,
      emailConfigurationNote: doc.emailConfigurationNote,
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    console.error('Error PATCH /admin/settings:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/admin/analytics?range=7d|30d|90d
export async function getAdminAnalytics(req: AuthRequest, res: Response): Promise<void> {
  try {
    const days = parseRangeDays(String(req.query.range || '7d'));
    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - days);
    rangeStart.setUTCHours(0, 0, 0, 0);

    const thirtyDaysStart = new Date(now);
    thirtyDaysStart.setUTCDate(thirtyDaysStart.getUTCDate() - 30);
    thirtyDaysStart.setUTCHours(0, 0, 0, 0);

    const [
      totalBusinesses,
      totalUsers,
      totalAppointments,
      appointmentsInRange,
      newUserSignups,
      newBusinessesInRange,
      revenueAgg,
      activeBusinessIds,
      planAgg,
      totalRevenueAllAgg,
      revenueLast30Agg,
      revenueByDayInRange,
      planRowsForMrr,
    ] = await Promise.all([
      Business.countDocuments(),
      User.countDocuments(),
      Appointment.countDocuments(),
      Appointment.countDocuments({ start: { $gte: rangeStart, $lte: now } }),
      User.countDocuments({ createdAt: { $gte: rangeStart, $lte: now } }),
      Business.countDocuments({ createdAt: { $gte: rangeStart, $lte: now } }),
      Appointment.aggregate<{ total: number }>([
        {
          $match: {
            start: { $gte: rangeStart, $lte: now },
            status: { $nin: ['cancelled'] },
            price: { $exists: true, $gt: 0 },
          },
        },
        { $group: { _id: null as unknown as string, total: { $sum: '$price' } } },
      ]),
      Appointment.distinct('businessId', {
        start: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      }),
      BusinessSettings.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$plan', count: { $sum: 1 } } },
      ]),
      Appointment.aggregate<{ total: number }>([
        {
          $match: {
            status: { $nin: ['cancelled'] },
            price: { $exists: true, $gt: 0 },
          },
        },
        { $group: { _id: null as unknown as string, total: { $sum: '$price' } } },
      ]),
      Appointment.aggregate<{ total: number }>([
        {
          $match: {
            start: { $gte: thirtyDaysStart, $lte: now },
            status: { $nin: ['cancelled'] },
            price: { $exists: true, $gt: 0 },
          },
        },
        { $group: { _id: null as unknown as string, total: { $sum: '$price' } } },
      ]),
      Appointment.aggregate<{ _id: string; total: number }>([
        {
          $match: {
            start: { $gte: rangeStart, $lte: now },
            status: { $nin: ['cancelled'] },
            price: { $exists: true, $gt: 0 },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$start', timezone: 'UTC' },
            },
            total: { $sum: '$price' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      BusinessSettings.find().select('plan').lean(),
    ]);

    const revenueTotal = revenueAgg[0]?.total ?? 0;
    const totalRevenue = totalRevenueAllAgg[0]?.total ?? 0;
    const revenueLast30Days = revenueLast30Agg[0]?.total ?? 0;

    let mrr = 0;
    let payingBusinesses = 0;
    for (const row of planRowsForMrr) {
      const key = row.plan || 'free';
      const add = PLAN_MRR_USD[key] ?? 0;
      if (add > 0) payingBusinesses += 1;
      mrr += add;
    }

    const arpu =
      totalUsers > 0 ? Math.round((totalRevenue / totalUsers) * 100) / 100 : 0;
    const activeBusinesses = activeBusinessIds.length;

    const appointmentsByDay = await Appointment.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          start: { $gte: rangeStart, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$start', timezone: 'UTC' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const businessesByWeek = await Business.aggregate<{
      _id: { year: number; week: number };
      count: number;
      weekStart: Date;
    }>([
      {
        $match: {
          createdAt: { $gte: rangeStart, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            year: { $isoWeekYear: '$createdAt' },
            week: { $isoWeek: '$createdAt' },
          },
          count: { $sum: 1 },
          weekStart: { $min: '$createdAt' },
        },
      },
      { $sort: { weekStart: 1 } },
    ]);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
    const staleBusinessIds = await Appointment.distinct('businessId', {
      start: { $gte: thirtyDaysAgo },
    });
    const churnRiskBusinesses = Math.max(
      0,
      totalBusinesses - new Set(staleBusinessIds.map(String)).size
    );

    res.json({
      rangeDays: days,
      totals: {
        businesses: totalBusinesses,
        activeBusinesses,
        users: totalUsers,
        appointments: totalAppointments,
        appointmentsInRange,
        revenueInRange: revenueTotal,
        totalRevenue,
        revenueLast30Days,
        mrr,
        arpu,
        payingBusinesses,
        newUserSignups,
        newBusinessesInRange,
        churnRiskBusinesses,
      },
      charts: {
        appointmentsByDay: appointmentsByDay.map((d) => ({ date: d._id, count: d.count })),
        newBusinessesByWeek: businessesByWeek.map((w) => ({
          label: `${w._id.year}-W${String(w._id.week).padStart(2, '0')}`,
          count: w.count,
        })),
        planDistribution: planAgg.map((p) => ({ plan: p._id || 'unknown', count: p.count })),
        revenueByDay: revenueByDayInRange.map((d) => ({ date: d._id, amount: d.total })),
      },
    });
  } catch (err) {
    console.error('Error GET /admin/analytics:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/admin/audit
export async function getAdminAudit(req: AuthRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '25'), 10) || 25));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const action = String(req.query.action || '').trim();
    const entity = String(req.query.entity || '').trim();

    const filter: Record<string, unknown> = {};
    if (action) filter.action = action;
    if (entity) filter.entity = entity;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ actorEmail: rx }, { entityId: rx }, { action: rx }];
    }

    const [total, rows] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);

    res.json({
      items: rows.map((r) => ({
        id: r._id.toString(),
        timestamp: r.createdAt,
        actor: r.actorEmail ?? r.actorUserId?.toString() ?? '—',
        action: r.action,
        entity: r.entity,
        entityId: r.entityId ?? '—',
        metadata: r.metadata ?? {},
      })),
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error('Error GET /admin/audit:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}
