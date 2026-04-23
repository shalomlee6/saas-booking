import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Business } from '../models/Business';
import { Appointment } from '../models/Appointment';
import { BusinessSettings } from '../models/BusinessSettings';
import { PlatformSettings } from '../models/PlatformSettings';
import { AuditLog } from '../models/AuditLog';
import { Service } from '../models/Service';
import { recordAudit } from '../utils/recordAudit';
import { normalizePlan, type PlanTier } from '../utils/planPolicy';
import { syncBusinessPlanDocuments } from '../utils/provisionTenant';
import { normalizeBusinessSlugInput } from '../utils/slug';

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

type AdminAnalyticsWindow = { rangeStart: Date; rangeEnd: Date; rangeDays: number };

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function parseAdminAnalyticsWindow(req: AuthRequest): AdminAnalyticsWindow | null {
  const range = String(req.query.range || '7d');
  const now = new Date();
  if (range === 'custom') {
    const fromStr = typeof req.query.from === 'string' ? req.query.from : '';
    const toStr = typeof req.query.to === 'string' ? req.query.to : '';
    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (!fromStr || !toStr || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      return null;
    }
    const rangeStart = startOfUtcDay(from);
    const rangeEnd = new Date(to);
    rangeEnd.setUTCHours(23, 59, 59, 999);
    const end = now < rangeEnd ? now : rangeEnd;
    const ms = end.getTime() - rangeStart.getTime();
    const rangeDays = Math.max(1, Math.ceil(ms / 86400000));
    return { rangeStart, rangeEnd: end, rangeDays };
  }
  const days = range === '90d' ? 90 : range === '30d' ? 30 : 7;
  const rangeStart = new Date(now);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - days);
  rangeStart.setUTCHours(0, 0, 0, 0);
  return { rangeStart, rangeEnd: now, rangeDays: days };
}

/** Estimated MRR per plan when billing integration is not present (USD). */
const PLAN_MRR_USD: Record<string, number> = {
  free: 0,
  normal: 49,
  pro: 49,
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
    const planFilter = String(req.query.plan || '').trim();
    const rawSortField = String(req.query.sortField || 'createdAt');
    const sortField = ['name', 'email', 'createdAt', 'lastLoginAt'].includes(rawSortField)
      ? rawSortField
      : 'createdAt';
    const sortDir = String(req.query.sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDir };

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
    if (planFilter === 'free' || planFilter === 'pro' || planFilter === 'premium') {
      const businessesWithPlan = await Business.find({ plan: planFilter }).select('_id').lean();
      const ids = businessesWithPlan.map((b) => b._id);
      filter.businessId = { $in: ids };
    }
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ email: rx }, { name: rx }];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).sort(sort).skip(skip).limit(limit).lean(),
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
            .select('name plan')
            .lean()
        : [];
    const businessNameById = new Map(
      businesses.map((b) => [b._id.toString(), b.name as string])
    );
    const businessPlanById = new Map<string, PlanTier>(
      businesses.map((b) => [
        b._id.toString(),
        normalizePlan(typeof (b as { plan?: string }).plan === 'string' ? (b as { plan: string }).plan : null),
      ])
    );

    const items = users.map((u) => {
      const bid = u.businessId?.toString() ?? null;
      return {
        id: u._id.toString(),
        email: u.email,
        name: (u as { name?: string }).name?.trim() || '',
        phone: (u as { phone?: string }).phone?.trim() || null,
        role: u.role,
        status: (u as { status?: string }).status || 'active',
        businessId: bid,
        businessName: bid ? businessNameById.get(bid) ?? null : null,
        plan: bid ? businessPlanById.get(bid) ?? 'free' : null,
        createdAt: u.createdAt,
        lastLoginAt: (u as { lastLoginAt?: Date }).lastLoginAt ?? null,
      };
    });

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
    let plan: PlanTier | null = null;
    let businessFeatures: {
      bookingEnabled: boolean;
      marketingModule: boolean;
      waitlistEnabled: boolean;
      analyticsEnabled: boolean;
    } | null = null;
    if (u.businessId) {
      const b = await Business.findById(u.businessId).select('name plan').lean();
      businessName = b?.name ?? null;
      plan = normalizePlan(typeof (b as { plan?: string } | null)?.plan === 'string' ? (b as { plan: string }).plan : null);
      const settings = await BusinessSettings.findOne({ businessId: u.businessId }).select('features').lean();
      const f = settings?.features as
        | {
            bookingEnabled?: boolean;
            marketingModule?: boolean;
            waitlistEnabled?: boolean;
            analyticsEnabled?: boolean;
          }
        | undefined;
      if (f) {
        businessFeatures = {
          bookingEnabled: f.bookingEnabled !== false,
          marketingModule: !!f.marketingModule,
          waitlistEnabled: !!f.waitlistEnabled,
          analyticsEnabled: !!f.analyticsEnabled,
        };
      }
    }
    res.json({
      id: u._id.toString(),
      email: u.email,
      name: (u as { name?: string }).name?.trim() || '',
      phone: (u as { phone?: string }).phone?.trim() || null,
      role: u.role,
      status: (u as { status?: string }).status || 'active',
      businessId: u.businessId?.toString() ?? null,
      businessName,
      plan,
      businessFeatures,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      lastLoginAt: (u as { lastLoginAt?: Date }).lastLoginAt ?? null,
    });
  } catch (err) {
    console.error('Error GET /admin/users/:id:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/admin/check-slug?slug=
export async function getAdminCheckSlug(req: AuthRequest, res: Response): Promise<void> {
  try {
    const slug = normalizeBusinessSlugInput(String(req.query.slug ?? ''));
    if (slug.length < 2) {
      res.json({ available: false });
      return;
    }
    const taken = await Business.findOne({ slug }).select('_id').lean();
    res.json({ available: !taken });
  } catch (err) {
    console.error('Error GET /admin/check-slug:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PATCH /api/admin/users/:id/plan
export async function patchAdminUserPlan(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid user id' });
      return;
    }
    const body = req.body as { plan?: string };
    const tier = body.plan;
    if (tier !== 'free' && tier !== 'pro' && tier !== 'premium') {
      res.status(400).json({ message: 'Invalid plan' });
      return;
    }
    const plan = tier as PlanTier;
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    if (!user.businessId) {
      res.status(400).json({ message: 'User has no linked business' });
      return;
    }

    await syncBusinessPlanDocuments(user.businessId, plan);

    await recordAudit({
      actorUserId: req.user?.userId,
      actorEmail: req.user?.email,
      action: 'business.plan_update',
      entity: 'Business',
      entityId: user.businessId.toString(),
      metadata: { targetUserId: id, plan },
    });

    let planOut: PlanTier | null = null;
    let businessName: string | null = null;
    const b = await Business.findById(user.businessId).select('name plan').lean();
    businessName = b?.name ?? null;
    planOut = normalizePlan(typeof (b as { plan?: string } | null)?.plan === 'string' ? (b as { plan: string }).plan : null);

    res.json({
      id: user._id.toString(),
      email: user.email,
      name: user.name ?? '',
      phone: user.phone?.trim() || null,
      role: user.role,
      status: user.status,
      businessId: user.businessId?.toString() ?? null,
      businessName,
      plan: planOut,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt ?? null,
    });
  } catch (err) {
    console.error('Error PATCH /admin/users/:id/plan:', err);
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
    const body = req.body as {
      status?: string;
      name?: string;
      email?: string;
      role?: string;
      suspensionReason?: string;
      businessFeatures?: {
        bookingEnabled?: boolean;
        marketingModule?: boolean;
        waitlistEnabled?: boolean;
        analyticsEnabled?: boolean;
      };
    };
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
    if (typeof body.email === 'string' && body.email !== user.email) {
      const dup = await User.findOne({ email: body.email, _id: { $ne: user._id } }).select('_id').lean();
      if (dup) {
        res.status(400).json({ message: 'Email already in use' });
        return;
      }
      user.email = body.email;
    }
    if (body.role !== undefined && body.role !== user.role) {
      if (user.role === 'super_admin' || user.role === 'owner') {
        res.status(400).json({ message: 'Cannot change role for this account type' });
        return;
      }
      if (body.role === 'super_admin' || body.role === 'owner') {
        res.status(400).json({ message: 'Cannot assign this role via admin panel' });
        return;
      }
      if (!USER_ROLES.includes(body.role as (typeof USER_ROLES)[number])) {
        res.status(400).json({ message: 'Invalid role' });
        return;
      }
      user.role = body.role as (typeof USER_ROLES)[number];
    }

    if (body.businessFeatures && user.businessId) {
      const bf = body.businessFeatures;
      const setDoc: Record<string, boolean> = {};
      if (typeof bf.bookingEnabled === 'boolean') setDoc['features.bookingEnabled'] = bf.bookingEnabled;
      if (typeof bf.marketingModule === 'boolean') setDoc['features.marketingModule'] = bf.marketingModule;
      if (typeof bf.waitlistEnabled === 'boolean') setDoc['features.waitlistEnabled'] = bf.waitlistEnabled;
      if (typeof bf.analyticsEnabled === 'boolean') setDoc['features.analyticsEnabled'] = bf.analyticsEnabled;
      if (Object.keys(setDoc).length > 0) {
        await BusinessSettings.updateOne({ businessId: user.businessId }, { $set: setDoc });
      }
    }

    await user.save();

    const auditMeta: Record<string, unknown> = { status: user.status, name: user.name, email: user.email, role: user.role };
    if (body.suspensionReason && user.status === 'disabled') {
      auditMeta['suspensionReason'] = body.suspensionReason.trim().slice(0, 500);
    }
    await recordAudit({
      actorUserId: req.user?.userId,
      actorEmail: req.user?.email,
      action: 'user.update',
      entity: 'User',
      entityId: id,
      metadata: auditMeta,
    });

    let plan: PlanTier | null = null;
    let businessName: string | null = null;
    let businessFeatures: {
      bookingEnabled: boolean;
      marketingModule: boolean;
      waitlistEnabled: boolean;
      analyticsEnabled: boolean;
    } | null = null;
    if (user.businessId) {
      const b = await Business.findById(user.businessId).select('name plan').lean();
      businessName = b?.name ?? null;
      plan = normalizePlan(typeof (b as { plan?: string } | null)?.plan === 'string' ? (b as { plan: string }).plan : null);
      const settings = await BusinessSettings.findOne({ businessId: user.businessId }).select('features').lean();
      const f = settings?.features as
        | {
            bookingEnabled?: boolean;
            marketingModule?: boolean;
            waitlistEnabled?: boolean;
            analyticsEnabled?: boolean;
          }
        | undefined;
      if (f) {
        businessFeatures = {
          bookingEnabled: f.bookingEnabled !== false,
          marketingModule: !!f.marketingModule,
          waitlistEnabled: !!f.waitlistEnabled,
          analyticsEnabled: !!f.analyticsEnabled,
        };
      }
    }

    res.json({
      id: user._id.toString(),
      email: user.email,
      name: user.name ?? '',
      phone: user.phone?.trim() || null,
      role: user.role,
      status: user.status,
      businessId: user.businessId?.toString() ?? null,
      businessName,
      plan,
      businessFeatures,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt ?? null,
    });
  } catch (err) {
    console.error('Error PATCH /admin/users/:id:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// DELETE /api/admin/users/:id
export async function deleteAdminUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid user id' });
      return;
    }
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    if (user.role === 'super_admin') {
      res.status(403).json({ message: 'Cannot delete a super admin' });
      return;
    }
    if (user.role === 'owner') {
      res.status(400).json({
        message:
          'Cannot delete a business owner from the users list. Disable the account or remove the tenant from the database.',
      });
      return;
    }
    await User.deleteOne({ _id: id });
    await recordAudit({
      actorUserId: req.user?.userId,
      actorEmail: req.user?.email,
      action: 'user.delete',
      entity: 'User',
      entityId: id,
      metadata: { email: user.email, role: user.role },
    });
    res.status(204).send();
  } catch (err) {
    console.error('Error DELETE /admin/users/:id:', err);
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

// GET /api/admin/analytics?range=7d|30d|90d|custom&from=&to=
export async function getAdminAnalytics(req: AuthRequest, res: Response): Promise<void> {
  try {
    const win = parseAdminAnalyticsWindow(req);
    if (!win) {
      res.status(400).json({ message: 'Invalid custom range; provide from and to (ISO dates).' });
      return;
    }
    const { rangeStart, rangeEnd: now, rangeDays: days } = win;

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

// GET /api/admin/overview — dashboard KPIs and insight strings (real DB aggregates)
export async function getAdminOverview(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const now = new Date();
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
    const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const monthPromises: Promise<{ year: number; month: number; count: number }>[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const ms = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1, 0, 0, 0, 0));
      const me = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1, 0, 0, 0, 0));
      monthPromises.push(
        Appointment.countDocuments({
          start: { $gte: ms, $lt: me },
          status: { $ne: 'cancelled' },
        }).then((count) => ({
          year: ms.getUTCFullYear(),
          month: ms.getUTCMonth() + 1,
          count,
        }))
      );
    }

    const [
      totalBusinesses,
      totalAppointments,
      appointmentsThisMonth,
      appointmentsLastMonth,
      activeBusinessIds,
      totalRevenueAgg,
      newBusinessesThisMonth,
      newBusinessesLastMonth,
      topPerforming,
      chartAppointmentsByMonth,
      businessesWithRecentBooking,
      heavyServiceBusinesses,
    ] = await Promise.all([
      Business.countDocuments(),
      Appointment.countDocuments({ status: { $ne: 'cancelled' } }),
      Appointment.countDocuments({
        start: { $gte: thisMonthStart, $lt: nextMonthStart },
        status: { $ne: 'cancelled' },
      }),
      Appointment.countDocuments({
        start: { $gte: lastMonthStart, $lt: thisMonthStart },
        status: { $ne: 'cancelled' },
      }),
      Appointment.distinct('businessId', {
        start: { $gte: thirtyDaysAgo, $lte: now },
        status: { $ne: 'cancelled' },
      }),
      Appointment.aggregate<{ total: number }>([
        {
          $match: {
            status: { $nin: ['cancelled'] },
            price: { $exists: true, $gte: 0 },
          },
        },
        { $group: { _id: null as unknown as string, total: { $sum: { $ifNull: ['$price', 0] } } } },
      ]),
      Business.countDocuments({ createdAt: { $gte: thisMonthStart, $lt: nextMonthStart } }),
      Business.countDocuments({ createdAt: { $gte: lastMonthStart, $lt: thisMonthStart } }),
      Appointment.aggregate<{ _id: Types.ObjectId; c: number }>([
        {
          $match: {
            start: { $gte: thisMonthStart, $lt: nextMonthStart },
            status: { $ne: 'cancelled' },
          },
        },
        { $group: { _id: '$businessId', c: { $sum: 1 } } },
        { $sort: { c: -1 } },
        { $limit: 1 },
      ]),
      Promise.all(monthPromises),
      Appointment.distinct('businessId', {
        start: { $gte: thirtyDaysAgo, $lte: now },
        status: { $ne: 'cancelled' },
      }),
      Service.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $group: { _id: '$businessId', n: { $sum: 1 } } },
        { $match: { n: { $gte: 2 } } },
      ]),
    ]);

    const totalRevenue = totalRevenueAgg[0]?.total ?? 0;
    const activeBusinesses = activeBusinessIds.length;
    const monthOverMonthGrowthPercent =
      appointmentsLastMonth === 0
        ? appointmentsThisMonth > 0
          ? 100
          : 0
        : Math.round(((appointmentsThisMonth - appointmentsLastMonth) / appointmentsLastMonth) * 1000) / 10;

    const businessesMonthOverMonthGrowthPercent =
      newBusinessesLastMonth === 0
        ? newBusinessesThisMonth > 0
          ? 100
          : 0
        : Math.round(((newBusinessesThisMonth - newBusinessesLastMonth) / newBusinessesLastMonth) * 1000) / 10;

    const avgBookingsPerBusiness =
      totalBusinesses > 0 ? Math.round((totalAppointments / totalBusinesses) * 100) / 100 : 0;

    const busySet = new Set(businessesWithRecentBooking.map((id) => String(id)));
    const businessesIdleOver30Days = Math.max(0, totalBusinesses - busySet.size);

    let topName: string | null = null;
    let topCount = 0;
    const topRow = topPerforming[0];
    if (topRow) {
      topCount = topRow.c;
      const bdoc = await Business.findById(topRow._id).select('name').lean();
      topName = bdoc?.name ?? null;
    }

    const capIds = heavyServiceBusinesses.map((x) => x._id);
    const freePlanHeavy =
      capIds.length === 0
        ? 0
        : await Business.countDocuments({
            _id: { $in: capIds },
            $or: [{ plan: 'free' }, { plan: { $exists: false } }],
          });

    const insights: string[] = [];
    if (businessesIdleOver30Days > 0) {
      insights.push(
        `${businessesIdleOver30Days} business${businessesIdleOver30Days === 1 ? ' has' : 'es have'} had no bookings in the last 30 days — consider reaching out.`
      );
    }
    if (!(appointmentsThisMonth === 0 && appointmentsLastMonth === 0)) {
      const dir = monthOverMonthGrowthPercent >= 0 ? 'up' : 'down';
      insights.push(
        `Appointments ${dir} ${Math.abs(monthOverMonthGrowthPercent)}% this month vs last month.`
      );
    }
    if (freePlanHeavy > 0) {
      insights.push(
        `${freePlanHeavy} business${freePlanHeavy === 1 ? ' is' : 'es are'} on the Free plan with ${freePlanHeavy === 1 ? 'its' : 'their'} service catalog near the plan limit — upsell opportunity.`
      );
    }

    res.json({
      totalBusinesses,
      activeBusinesses,
      totalAppointments,
      appointmentsThisMonth,
      appointmentsLastMonth,
      monthOverMonthGrowthPercent,
      totalRevenue,
      newBusinessesThisMonth,
      newBusinessesLastMonth,
      businessesMonthOverMonthGrowthPercent,
      topPerformingBusiness:
        topName !== null
          ? { name: topName, bookingCount: topCount }
          : { name: null, bookingCount: 0 },
      avgBookingsPerBusiness,
      insights,
      chartAppointmentsByMonth: chartAppointmentsByMonth.map((m) => ({
        period: `${m.year}-${String(m.month).padStart(2, '0')}`,
        count: m.count,
      })),
    });
  } catch (err) {
    console.error('Error GET /admin/overview:', err);
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
