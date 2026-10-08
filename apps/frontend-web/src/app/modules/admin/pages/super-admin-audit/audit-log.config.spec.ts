import { buildAuditLogConfig, AUDIT_LOG_SORT_FIELDS } from './audit-log.config';
import type { AdminAuditRow } from '../../services/admin-api.service';

const BACKEND_SORT_ALLOWLIST = ['timestamp', 'actor', 'action'];

const sample: AdminAuditRow = {
  id: 'audit-1',
  timestamp: '2026-04-02T09:30:00.000Z',
  actor: 'system',
  action: 'appointment.auto_completed',
  entity: 'Appointment',
  entityId: 'appt-1',
  metadata: { businessId: 'biz-1' },
};

describe('audit log config', () => {
  const config = buildAuditLogConfig({
    t: (key) => key,
    onView: () => undefined,
  });

  it('uses only sort fields the audit API allowlist accepts', () => {
    expect(BACKEND_SORT_ALLOWLIST.length).toBe(AUDIT_LOG_SORT_FIELDS.length);
    for (const field of AUDIT_LOG_SORT_FIELDS) {
      expect(BACKEND_SORT_ALLOWLIST.includes(field)).toBeTrue();
    }
    for (const sort of config.sorts) {
      expect(BACKEND_SORT_ALLOWLIST.includes(sort.field)).toBeTrue();
    }
  });

  it('is read-only: no selection, bulk, export, or metadata column', () => {
    expect(config.permissions.bulk).toBeFalse();
    expect(config.permissions.export).toBeFalse();
    expect(config.bulkActions.length).toBe(0);
    expect(config.primaryAction).toBeUndefined();
    expect(config.defaultOrder).toBe('desc');
    expect(config.columns.some((column) => column.id === 'metadata')).toBeFalse();
    expect(config.rowActions.map((action) => action.id)).toEqual(['view']);
  });

  it('keeps the date preset inline and the other filters in the drawer', () => {
    const date = config.filters.find((filter) => filter.id === 'date');
    expect(date?.kind).toBe('date-preset');
    expect(date?.placement).toBe('quick');
    for (const filter of config.filters.filter((item) => item.id !== 'date')) {
      expect(filter.placement).toBe('drawer');
    }
  });

  it('shows system as a tag and hides metadata from the row', () => {
    const actor = config.columns.find((column) => column.id === 'actor');
    const tags = actor?.tags?.(sample) ?? [];
    expect(tags.length).toBe(1);
    expect(tags[0].label).toBe('audit.system');
    const entityId = config.columns.find((column) => column.id === 'entityId');
    expect(entityId?.mono).toBeTrue();
    expect(entityId?.showOnSmallScreen).toBeFalse();
    expect(entityId?.copy?.(sample)).toBe('appt-1');
  });
});
