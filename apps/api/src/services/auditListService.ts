import { AuditLog } from '../models/AuditLog';
import {
  DEFAULT_BUSINESS_TIMEZONE,
  resolveDateRange,
  startOfBusinessDay,
  type DateRangePreset,
} from '../listQuery/dateRange';
import { isValidYyyyMmDd } from '../validation/strictCalendar';

export const AUDIT_SORT_FIELDS = ['timestamp', 'actor', 'action'] as const;
export type AuditSortField = (typeof AUDIT_SORT_FIELDS)[number];

const AUDIT_TIME_ZONE = DEFAULT_BUSINESS_TIMEZONE;

const PRESET_ALIASES: Record<string, DateRangePreset> = {
  today: 'today',
  last7: 'last7Days',
  last7days: 'last7Days',
  last30: 'last30Days',
  last30days: 'last30Days',
  thismonth: 'thisMonth',
  custom: 'custom',
};

const SORT_PATH: Record<AuditSortField, string> = {
  timestamp: 'createdAt',
  actor: 'actorEmail',
  action: 'action',
};

export class AuditQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuditQueryError';
  }
}

export interface AdminAuditItem {
  id: string;
  timestamp: Date;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  metadata: Record<string, unknown>;
  impersonatingSuperAdminId?: string;
}

export interface AdminAuditListPage {
  items: AdminAuditItem[];
  total: number;
  page: number;
  limit: number;
}

function queryString(value: unknown): string {
  if (Array.isArray(value)) return queryString(value[0]);
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function queryList(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];
  const raw = Array.isArray(value) ? value.map((part) => String(part)).join(',') : String(value);
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Same clamping the original handler used, so page/limit stay compatible. */
function clampPage(value: unknown): number {
  const parsed = parseInt(queryString(value) || '1', 10);
  return Math.max(1, parsed || 1);
}

function clampLimit(value: unknown): number {
  const parsed = parseInt(queryString(value) || '25', 10);
  return Math.min(100, Math.max(1, parsed || 25));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function calendarBound(label: 'from' | 'to', value: string): Date {
  if (!isValidYyyyMmDd(value)) {
    throw new AuditQueryError(`${label} must be a valid calendar date (YYYY-MM-DD)`);
  }
  return startOfBusinessDay(value, AUDIT_TIME_ZONE);
}

function dateWindow(query: Record<string, unknown>): { start?: Date; end?: Date } | null {
  const presetKey = queryString(query.date).toLowerCase();
  const from = queryString(query.from);
  const to = queryString(query.to);

  if (presetKey) {
    const preset = PRESET_ALIASES[presetKey];
    if (!preset) throw new AuditQueryError('Unknown date preset');
    if (preset === 'custom') {
      if (!from || !to) throw new AuditQueryError('Custom range requires from and to');
    } else {
      const range = resolveDateRange({ preset, timezone: AUDIT_TIME_ZONE });
      return { start: range.start, end: range.end };
    }
  }

  if (!from && !to) return null;
  const start = from ? calendarBound('from', from) : undefined;
  const end = to ? calendarBound('to', to) : undefined;
  if (start && end && start.getTime() >= end.getTime()) {
    throw new AuditQueryError('Date range must be half-open [from, to)');
  }
  return { start, end };
}

function sortSpec(query: Record<string, unknown>): Record<string, 1 | -1> {
  const field = queryString(query.sort);
  const orderRaw = queryString(query.order);
  if (orderRaw && orderRaw !== 'asc' && orderRaw !== 'desc') {
    throw new AuditQueryError('Sort order must be asc or desc');
  }
  const direction: 1 | -1 = orderRaw === 'asc' ? 1 : -1;
  if (!field) return { createdAt: -1 };
  if (!AUDIT_SORT_FIELDS.includes(field as AuditSortField)) {
    throw new AuditQueryError('Sort field is not allowed');
  }
  return { [SORT_PATH[field as AuditSortField]]: direction };
}

function impersonatingId(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const raw = (metadata as Record<string, unknown>).impersonatingSuperAdminId;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function listAdminAudit(query: Record<string, unknown>): Promise<AdminAuditListPage> {
  const page = clampPage(query.page);
  const limit = clampLimit(query.limit);
  const search = queryString(query.search);
  const actions = queryList(query.action);
  const entity = queryString(query.entity);
  const actor = queryString(query.actor);
  const window = dateWindow(query);

  const filter: Record<string, unknown> = {};
  if (actions.length === 1) filter.action = actions[0];
  else if (actions.length > 1) filter.action = { $in: actions };
  if (entity) filter.entity = entity;
  if (actor) {
    filter.actorEmail =
      actor.toLowerCase() === 'system'
        ? 'system'
        : new RegExp(`^${escapeRegex(actor)}$`, 'i');
  }
  if (window?.start || window?.end) {
    const createdAt: Record<string, Date> = {};
    if (window.start) createdAt.$gte = window.start;
    if (window.end) createdAt.$lt = window.end;
    filter.createdAt = createdAt;
  }
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ actorEmail: rx }, { entityId: rx }, { action: rx }];
  }

  const [total, rows] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter).sort(sortSpec(query)).skip((page - 1) * limit).limit(limit).lean(),
  ]);

  return {
    items: rows.map((row) => {
      const metadata =
        row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {};
      const impersonatingSuperAdminId = impersonatingId(metadata);
      return {
        id: row._id.toString(),
        timestamp: row.createdAt,
        actor: row.actorEmail ?? row.actorUserId?.toString() ?? '—',
        action: row.action,
        entity: row.entity,
        entityId: row.entityId ?? '—',
        metadata,
        ...(impersonatingSuperAdminId ? { impersonatingSuperAdminId } : {}),
      };
    }),
    total,
    page,
    limit,
  };
}
