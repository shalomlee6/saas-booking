import { CUSTOMER_LIST_SORT_FIELDS } from '../../model/customer-list-row';
import { buildCustomerTableConfig } from './customer-list.config';

const BACKEND_SORT_ALLOWLIST = [
  'name',
  'phone',
  'createdAt',
  'totalVisits',
  'totalRevenue',
  'averageVisitValue',
  'lastVisit',
  'nextAppointment',
  'noShowCount',
];

describe('customer list config', () => {
  const config = buildCustomerTableConfig({
    t: (key) => key,
    locale: 'en',
    owner: true,
    services: [],
    onView: () => undefined,
    onEdit: () => undefined,
    onBook: () => undefined,
    onSetActive: () => undefined,
    onExcuseAllNoShows: () => undefined,
    onCreate: () => undefined,
    onBulkSetActive: () => undefined,
  });

  it('uses only sort fields the customers API allowlist accepts', () => {
    expect(BACKEND_SORT_ALLOWLIST.length).toBe(CUSTOMER_LIST_SORT_FIELDS.length);
    for (const field of CUSTOMER_LIST_SORT_FIELDS) {
      expect(BACKEND_SORT_ALLOWLIST.includes(field)).toBeTrue();
    }
    for (const sort of config.sorts) {
      expect(BACKEND_SORT_ALLOWLIST.includes(sort.field)).toBeTrue();
    }
  });

  it('hides the excuse-all action until the customer has no-shows', () => {
    const action = config.rowActions.find((item) => item.id === 'excuse-all');
    expect(action?.keepSlot).toBeTrue();
    expect(action?.icon).toBe('pi pi-refresh');
    expect(action?.confirmReason).toBeTrue();
    expect(action?.visible?.({ _id: '1', name: 'A', phone: '1', isActive: true, createdAt: '', noShowCount: 0 })).toBeFalse();
    expect(action?.visible?.({ _id: '1', name: 'A', phone: '1', isActive: true, createdAt: '', noShowCount: 2 })).toBeTrue();
  });

  it('tags a blocked customer and an always-allowed customer', () => {
    const status = config.columns.find((column) => column.id === 'isActive');
    const row = { _id: '1', name: 'A', phone: '1', isActive: true, createdAt: '' };
    const blocked = status?.tags?.({ ...row, blocked: true }) ?? [];
    const allowed = status?.tags?.({ ...row, bookingOverride: 'allow' }) ?? [];
    expect(blocked.some((tag) => tag.label === 'customers.blockedTag')).toBeTrue();
    expect(allowed.some((tag) => tag.label === 'customers.alwaysAllowedTag')).toBeTrue();
    expect(allowed.some((tag) => tag.label === 'customers.blockedTag')).toBeFalse();
  });

  it('maps visit and revenue presets onto the existing half-open range params', () => {
    const visits = config.filters.find((filter) => filter.id === 'visits');
    const revenue = config.filters.find((filter) => filter.id === 'revenue');
    const activity = config.filters.find((filter) => filter.id === 'activity');
    expect(visits?.kind).toBe('preset');
    expect(revenue?.kind).toBe('preset');
    if (visits?.kind !== 'preset' || revenue?.kind !== 'preset' || activity?.kind !== 'preset') return;
    expect(visits.options.find((option) => option.value === '0')?.params).toEqual({ visitsMax: '1' });
    expect(visits.options.find((option) => option.value === '1')?.params).toEqual({ visitsMin: '1', visitsMax: '2' });
    expect(visits.options.find((option) => option.value === '2-5')?.params).toEqual({ visitsMin: '2', visitsMax: '6' });
    expect(visits.options.find((option) => option.value === '6-10')?.params).toEqual({ visitsMin: '6', visitsMax: '11' });
    expect(visits.options.find((option) => option.value === '10+')?.params).toEqual({ visitsMin: '10' });
    expect(revenue.options.find((option) => option.value === '0-500')?.params).toEqual({ revenueMin: '0', revenueMax: '500' });
    expect(revenue.options.find((option) => option.value === '2500+')?.params).toEqual({ revenueMin: '2500' });
    expect(activity.options.find((option) => option.value === 'noVisits')?.params).toEqual({ activity: 'noVisits' });
    expect(activity.options.find((option) => option.value === 'noUpcoming')?.params).toEqual({ activity: 'noUpcoming' });
    expect(activity.options.find((option) => option.value === 'lastVisitOver30')?.params).toEqual({ activity: 'lastVisitOver30' });
    expect(activity.options.find((option) => option.value === 'lastVisitOver60')?.params).toEqual({ activity: 'lastVisitOver60' });
    expect(activity.options.find((option) => option.value === 'lastVisitOver90')?.params).toEqual({ activity: 'lastVisitOver90' });
  });

  it('moves the customer type filter into the drawer and keeps only status as a quick filter', () => {
    const quick = config.filters.filter((filter) => filter.placement === 'quick').map((filter) => filter.id);
    expect(quick).toEqual(['status']);
    expect(config.filters.find((filter) => filter.id === 'customerType')?.placement).toBe('drawer');
  });

  it('merges the phone under the name and keeps the phone column opt-in', () => {
    const row = { _id: '1', name: 'Noa Cohen', phone: '050-1234567', isActive: true, createdAt: '' };
    const name = config.columns.find((column) => column.id === 'name');
    expect(name?.avatar).toBeTrue();
    expect(name?.value(row)).toBe('Noa Cohen');
    expect(name?.secondary?.(row)).toBe('050-1234567');
    expect(config.columns.find((column) => column.id === 'phone')?.visibility).toBe('optional');
  });

  it('shows the date with a relative hint, and the next appointment time under its date', () => {
    const last = config.columns.find((column) => column.id === 'lastVisit');
    const next = config.columns.find((column) => column.id === 'nextAppointment');
    const row = {
      _id: '1',
      name: 'A',
      phone: '1',
      isActive: true,
      createdAt: '',
      lastVisit: new Date(Date.now() - 12 * 86_400_000).toISOString(),
      nextAppointment: '2026-10-05T08:00:00Z',
    };
    expect(last?.value(row)).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(last?.secondary?.(row)).toContain('12');
    expect(next?.value(row)).toBe('05/10/2026');
    expect(next?.secondary?.(row)).toBe('11:00');
    expect(last?.value({ ...row, lastVisit: null })).toBe('—');
    expect(last?.secondary?.({ ...row, lastVisit: null })).toBe('');
  });

  it('builds the header: title, singular and plural counts, and an owner-only settings action', () => {
    expect(config.title).toBe('customers.title');
    expect(config.countLabel?.(1)).toBe('customers.countOne');
    expect(config.countLabel?.(142)).toBe('142 customers.countSuffix');
    expect(config.headerActions?.length ?? 0).toBe(0);
    const withSettings = buildCustomerTableConfig({
      t: (key) => key,
      locale: 'en',
      owner: true,
      services: [],
      onView: () => undefined,
      onEdit: () => undefined,
      onBook: () => undefined,
      onSetActive: () => undefined,
      onExcuseAllNoShows: () => undefined,
      onCreate: () => undefined,
      onBulkSetActive: () => undefined,
      onOpenSettings: () => undefined,
    });
    expect(withSettings.headerActions?.map((action) => action.id)).toEqual(['settings']);
    expect(withSettings.primaryAction?.icon).toBe('pi pi-plus');
  });
});
