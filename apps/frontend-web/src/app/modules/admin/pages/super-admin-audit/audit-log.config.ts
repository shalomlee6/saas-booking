import { formatJerusalemDate, formatJerusalemTime } from '../../../../shared/data-management/calendar-date';
import type {
  DataFilterOption,
  EntityDataManagementConfig,
} from '../../../../shared/data-management/entity-data-management-config';
import type { AdminAuditRow } from '../../services/admin-api.service';

/** Mirrors the audit API sort allowlist. */
export const AUDIT_LOG_SORT_FIELDS = ['timestamp', 'actor', 'action'] as const;

const ACTION_CODES = [
  'service.exported',
  'service.activated',
  'service.deactivated',
  'customer.exported',
  'customer.no_shows_reset',
  'customer.no_shows_excused',
  'customer.booking_override_updated',
  'appointment.no_show_excused',
  'appointment.no_show_unexcused',
  'customer.no_show_policy_updated',
  'customer.activated',
  'customer.deactivated',
  'customer.reactivated',
  'appointment.auto_completed',
  'business.ui_updated_while_impersonating',
  'user.password_changed',
  'user.password_reset',
  'business.plan_update',
  'user.update',
  'user.delete',
  'platform_settings.update',
  'business.provision',
  'impersonation.start',
  'impersonation.stop',
  'admin_alert.dismiss',
  'admin_alert.resolve',
] as const;

export function isSystemActor(actor: string): boolean {
  return actor.trim().toLowerCase() === 'system';
}

export function auditActionLabel(t: (key: string) => string, code: string): string {
  const key = `audit.actionLabels.${code.replace(/\./g, '_')}`;
  const label = t(key);
  return label === key ? code.replace(/[._]/g, ' ') : label;
}

/** `dd/mm/yyyy HH:mm` in Asia/Jerusalem. Isolated so RTL does not swap the time in front of the date. */
export function formatAuditTimestamp(value: string): string {
  const date = formatJerusalemDate(value);
  const time = formatJerusalemTime(value);
  if (!date || date === '—') return '—';
  const text = time ? `${date} ${time}` : date;
  return `\u2066${text}\u2069`;
}

export interface AuditLogConfigInput {
  t: (key: string, params?: Record<string, string | number>) => string;
  onView: (row: AdminAuditRow) => void;
}

export function buildAuditLogConfig(
  input: AuditLogConfigInput
): EntityDataManagementConfig<AdminAuditRow> {
  const { t, onView } = input;
  const dateOptions: DataFilterOption[] = [
    { value: 'today', label: t('audit.today') },
    { value: 'last7', label: t('audit.last7') },
    { value: 'last30', label: t('audit.last30') },
    { value: 'thisMonth', label: t('audit.thisMonth') },
    { value: 'custom', label: t('audit.custom') },
  ];
  const actionOptions: DataFilterOption[] = ACTION_CODES.map((code) => ({
    value: code,
    label: auditActionLabel(t, code),
  }));

  return {
    title: t('audit.title'),
    countLabel: (total) => (total === 1 ? t('audit.countOne') : t('audit.count', { count: total })),
    empty: { icon: 'pi pi-shield', title: t('audit.empty'), hint: t('audit.emptyHint') },
    rowId: (row) => row.id,
    searchFields: ['actor', 'entityId', 'action'],
    searchPlaceholder: t('audit.searchPlaceholder'),
    defaultOrder: 'desc',
    columns: [
      {
        id: 'timestamp',
        header: t('audit.date'),
        visibility: 'default',
        showOnSmallScreen: true,
        value: (row) => formatAuditTimestamp(row.timestamp),
      },
      {
        id: 'actor',
        header: t('audit.user'),
        visibility: 'default',
        showOnSmallScreen: true,
        value: (row) => (isSystemActor(row.actor) ? t('audit.system') : row.actor || '—'),
        tags: (row) =>
          isSystemActor(row.actor) ? [{ label: t('audit.system'), severity: 'secondary' as const }] : [],
      },
      {
        id: 'action',
        header: t('audit.action'),
        visibility: 'default',
        showOnSmallScreen: true,
        value: (row) => auditActionLabel(t, row.action),
        secondary: (row) => row.action,
      },
      {
        id: 'entity',
        header: t('audit.entity'),
        visibility: 'default',
        showOnSmallScreen: true,
        value: (row) => row.entity || '—',
      },
      {
        id: 'entityId',
        header: t('audit.entityId'),
        visibility: 'default',
        showOnSmallScreen: false,
        mono: true,
        value: (row) => row.entityId || '—',
        copy: (row) => row.entityId,
      },
    ],
    filters: [
      {
        id: 'date',
        label: t('audit.datePreset'),
        kind: 'date-preset',
        placement: 'quick',
        fromId: 'from',
        toId: 'to',
        options: dateOptions,
      },
      {
        id: 'actor',
        label: t('audit.actor'),
        kind: 'text',
        placement: 'drawer',
      },
      {
        id: 'action',
        label: t('audit.actionsFilter'),
        kind: 'multi',
        placement: 'drawer',
        options: actionOptions,
      },
      {
        id: 'entity',
        label: t('audit.entityFilter'),
        kind: 'text',
        placement: 'drawer',
      },
    ],
    sorts: [
      { field: 'timestamp', label: t('audit.date') },
      { field: 'actor', label: t('audit.user') },
      { field: 'action', label: t('audit.action') },
    ],
    rowActions: [
      {
        id: 'view',
        label: t('audit.viewDetails'),
        icon: 'pi pi-eye',
        severity: 'secondary',
        run: onView,
      },
    ],
    bulkActions: [],
    onRowClick: onView,
    permissions: { metrics: false, bulk: false, export: false },
  };
}
