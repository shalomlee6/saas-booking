import {
  formatJerusalemDate,
  formatJerusalemTime,
  formatRelativeDay,
} from '../../../../shared/data-management/calendar-date';
import type {
  DataFilter,
  DataPresetOption,
  DataTag,
  EntityDataManagementConfig,
} from '../../../../shared/data-management/entity-data-management-config';
import { CUSTOMER_LIST_SORT_FIELDS, type CustomerListRow } from '../../model/customer-list-row';

const METRIC_SORTS = new Set<string>([
  'totalVisits',
  'totalRevenue',
  'averageVisitValue',
  'lastVisit',
  'nextAppointment',
  'noShowCount',
]);

export interface CustomerListConfigInput {
  t: (key: string) => string;
  locale: string;
  owner: boolean;
  services: readonly { id: string; name: string }[];
  onView: (row: CustomerListRow) => void;
  onEdit: (row: CustomerListRow) => void;
  onBook: (row: CustomerListRow) => void;
  onSetActive: (row: CustomerListRow, isActive: boolean) => void;
  onResetNoShows: (row: CustomerListRow) => void;
  onCreate: () => void;
  onBulkSetActive: (rows: CustomerListRow[], isActive: boolean) => void;
  onOpenSettings?: () => void;
}

function dateText(value: string | null | undefined): string {
  return formatJerusalemDate(value);
}

function money(value: number | undefined, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(
    value ?? 0
  );
}

export function buildCustomerTableConfig(
  input: CustomerListConfigInput
): EntityDataManagementConfig<CustomerListRow> {
  const { t, locale, owner } = input;
  const columns: EntityDataManagementConfig<CustomerListRow>['columns'] = [
    {
      id: 'name',
      header: t('customers.columnName'),
      visibility: 'default',
      showOnSmallScreen: true,
      avatar: true,
      value: (row) => row.name,
      secondary: (row) => row.phone,
    },
    // The phone already sits under the name. This stays as an opt-in column so the
    // phone sort (still in the API allowlist) remains reachable from a header.
    { id: 'phone', header: t('customers.columnPhone'), visibility: 'optional', showOnSmallScreen: false, value: (row) => row.phone },
    {
      id: 'isActive',
      header: t('customers.columnStatus'),
      visibility: 'default',
      showOnSmallScreen: true,
      value: (row) => (row.isActive ? t('customers.statusActive') : t('customers.statusInactive')),
      tags: (row) => {
        const tags: DataTag[] = [
          row.isActive
            ? { label: t('customers.statusActive'), severity: 'success' }
            : { label: t('customers.statusInactive'), severity: 'secondary' },
        ];
        if (row.blocked) tags.push({ label: t('customers.blockedTag'), severity: 'danger' });
        return tags;
      },
    },
    {
      id: 'totalVisits',
      header: t('customers.columnVisits'),
      visibility: 'default',
      showOnSmallScreen: false,
      align: 'end',
      numeric: true,
      value: (row) => String(row.totalVisits ?? 0),
    },
    {
      id: 'totalRevenue',
      header: t('customers.columnRevenue'),
      visibility: 'default',
      showOnSmallScreen: false,
      align: 'end',
      numeric: true,
      value: (row) => money(row.totalRevenue, locale),
    },
    {
      id: 'lastVisit',
      header: t('customers.columnLastVisit'),
      visibility: 'default',
      showOnSmallScreen: false,
      value: (row) => dateText(row.lastVisit),
      secondary: (row) => formatRelativeDay(row.lastVisit, locale),
    },
    {
      id: 'nextAppointment',
      header: t('customers.columnNext'),
      visibility: 'default',
      showOnSmallScreen: true,
      value: (row) => dateText(row.nextAppointment),
      secondary: (row) => formatJerusalemTime(row.nextAppointment),
    },
    { id: 'email', header: t('customers.columnEmail'), visibility: 'optional', showOnSmallScreen: false, value: (row) => row.email || '—' },
    {
      id: 'averageVisitValue',
      header: t('customers.columnAverage'),
      visibility: 'optional',
      showOnSmallScreen: false,
      align: 'end',
      numeric: true,
      value: (row) => money(row.averageVisitValue, locale),
    },
    {
      id: 'preferredServiceName',
      header: t('customers.columnPreferredService'),
      visibility: 'optional',
      showOnSmallScreen: false,
      value: (row) => row.preferredServiceName || '—',
    },
    {
      id: 'preferredTimeOfDay',
      header: t('customers.columnPreferredTime'),
      visibility: 'optional',
      showOnSmallScreen: false,
      value: (row) => (row.preferredTimeOfDay ? t(`timeOfDay.${row.preferredTimeOfDay}`) : '—'),
    },
    {
      id: 'createdAt',
      header: t('customers.columnSince'),
      visibility: 'optional',
      showOnSmallScreen: false,
      value: (row) => dateText(row.createdAt),
    },
    {
      id: 'noShowCount',
      header: t('customers.columnNoShows'),
      visibility: 'optional',
      showOnSmallScreen: false,
      align: 'end',
      numeric: true,
      value: (row) => String(row.noShowCount ?? 0),
    },
  ];
  const metricColumnIds = new Set([
    'totalVisits',
    'totalRevenue',
    'lastVisit',
    'nextAppointment',
    'averageVisitValue',
    'preferredServiceName',
    'preferredTimeOfDay',
    'noShowCount',
  ]);
  const visibleColumns = owner ? columns : columns.filter((column) => !metricColumnIds.has(column.id));
  const sorts = CUSTOMER_LIST_SORT_FIELDS.filter((field) => owner || !METRIC_SORTS.has(field)).map((field) => ({
    field,
    label: t(`customers.sort.${field}`),
  }));

  const visitPresets: DataPresetOption[] = [
    { value: '0', label: '0', params: { visitsMax: '1' } },
    { value: '1', label: '1', params: { visitsMin: '1', visitsMax: '2' } },
    { value: '2-5', label: '2–5', params: { visitsMin: '2', visitsMax: '6' } },
    { value: '6-10', label: '6–10', params: { visitsMin: '6', visitsMax: '11' } },
    { value: '10+', label: '10+', params: { visitsMin: '10' } },
  ];
  const revenuePresets: DataPresetOption[] = [
    { value: '0-500', label: '₪0–500', params: { revenueMin: '0', revenueMax: '500' } },
    { value: '500-1000', label: '₪500–1,000', params: { revenueMin: '500', revenueMax: '1000' } },
    { value: '1000-2500', label: '₪1,000–2,500', params: { revenueMin: '1000', revenueMax: '2500' } },
    { value: '2500+', label: '₪2,500+', params: { revenueMin: '2500' } },
  ];
  const activityPresets: DataPresetOption[] = [
    { value: 'noVisits', label: t('customers.activityNoVisits'), params: { activity: 'noVisits' } },
    { value: 'noUpcoming', label: t('customers.activityNoUpcoming'), params: { activity: 'noUpcoming' } },
    { value: 'lastVisitOver30', label: t('customers.activityOver30'), params: { activity: 'lastVisitOver30' } },
    { value: 'lastVisitOver60', label: t('customers.activityOver60'), params: { activity: 'lastVisitOver60' } },
    { value: 'lastVisitOver90', label: t('customers.activityOver90'), params: { activity: 'lastVisitOver90' } },
  ];
  const createdOptions = [
    { value: 'today', label: t('customers.createdToday') },
    { value: 'last7', label: t('customers.createdLast7') },
    { value: 'last30', label: t('customers.createdLast30') },
    { value: 'thisMonth', label: t('customers.createdThisMonth') },
    { value: 'previousMonth', label: t('customers.createdPreviousMonth') },
    { value: 'custom', label: t('customers.createdCustom') },
  ];

  const createdFilter: DataFilter = {
    id: 'created',
    label: t('customers.createdPreset'),
    kind: 'date-preset',
    placement: 'drawer',
    fromId: 'createdFrom',
    toId: 'createdTo',
    options: createdOptions,
  };
  const blockedFilter: DataFilter = {
    id: 'blocked',
    label: t('customers.blockedFilter'),
    kind: 'select',
    placement: 'drawer',
    options: [{ value: 'true', label: t('customers.blockedFilter') }],
  };
  const filters: DataFilter[] = [
    {
      id: 'status',
      label: t('customers.columnStatus'),
      kind: 'segment',
      placement: 'quick',
      options: [
        { value: 'active', label: t('customers.statusActiveGroup') },
        { value: 'inactive', label: t('customers.statusInactiveGroup') },
        { value: 'all', label: t('customers.statusAll') },
      ],
    },
  ];
  const customerTypeFilter: DataFilter = {
    id: 'customerType',
    label: t('customers.customerType'),
    kind: 'segment',
    placement: 'drawer',
    options: [
      { value: 'new', label: t('customers.customerTypeNew') },
      { value: 'returning', label: t('customers.customerTypeReturning') },
      { value: 'all', label: t('customers.statusAll') },
    ],
  };
  const drawerFilters: DataFilter[] = owner
    ? [
        customerTypeFilter,
        { id: 'visits', label: t('customers.visitsPreset'), kind: 'preset', placement: 'drawer', options: visitPresets },
        { id: 'revenue', label: t('customers.revenuePreset'), kind: 'preset', placement: 'drawer', options: revenuePresets },
        { id: 'activity', label: t('customers.activity'), kind: 'preset', placement: 'drawer', options: activityPresets },
        createdFilter,
        {
          id: 'preferredTime',
          label: t('customers.columnPreferredTime'),
          kind: 'select',
          placement: 'drawer',
          options: (['morning', 'afternoon', 'evening', 'night'] as const).map((value) => ({
            value,
            label: t(`timeOfDay.${value}`),
          })),
        },
        {
          id: 'preferredService',
          label: t('customers.columnPreferredService'),
          kind: 'select',
          placement: 'drawer',
          options: input.services.map((service) => ({ value: service.id, label: service.name })),
        },
        blockedFilter,
      ]
    : [createdFilter, blockedFilter];
  filters.push(...drawerFilters);

  return {
    title: t('customers.title'),
    countLabel: (total) =>
      total === 1
        ? t('customers.countOne')
        : `${new Intl.NumberFormat(locale).format(total)} ${t('customers.countSuffix')}`,
    headerActions:
      owner && input.onOpenSettings
        ? [
            {
              id: 'settings',
              label: t('customers.noShowSettings'),
              icon: 'pi pi-cog',
              run: input.onOpenSettings,
            },
          ]
        : [],
    empty: {
      icon: 'pi pi-users',
      title: t('customers.emptyTitle'),
      hint: t('customers.emptyText'),
      actionLabel: t('customers.addFirst'),
    },
    rowId: (row) => row._id,
    columns: visibleColumns,
    searchFields: ['name', 'phone', 'email'],
    searchPlaceholder: t('customers.searchPlaceholder'),
    filters,
    sorts,
    defaultFilters: owner ? { status: 'active', customerType: 'all' } : { status: 'active' },
    primaryAction: { label: t('customers.newCustomer'), icon: 'pi pi-plus', run: input.onCreate },
    onRowClick: input.onView,
    permissions: { metrics: owner, bulk: owner, export: owner },
    rowActions: [
      { id: 'view', label: t('common.view'), icon: 'pi pi-eye', severity: 'secondary', run: input.onView },
      { id: 'edit', label: t('common.edit'), icon: 'pi pi-pencil', severity: 'primary', run: input.onEdit },
      {
        id: 'book',
        label: t('customers.bookAppointment'),
        icon: 'pi pi-calendar-plus',
        severity: 'success',
        run: input.onBook,
      },
      {
        id: 'deactivate',
        label: t('customers.markInactiveAction'),
        icon: 'pi pi-user-minus',
        severity: 'danger',
        confirmText: t('customers.deactivateConfirm'),
        visible: (row) => row.isActive,
        run: (row) => input.onSetActive(row, false),
      },
      {
        id: 'activate',
        label: t('customers.markActive'),
        icon: 'pi pi-user-plus',
        severity: 'success',
        visible: (row) => !row.isActive,
        run: (row) => input.onSetActive(row, true),
      },
      {
        id: 'reset-no-shows',
        label: t('customers.resetNoShowsAction'),
        icon: 'pi pi-refresh',
        severity: 'warn',
        keepSlot: true,
        confirmText: t('customers.resetNoShowsConfirm'),
        visible: (row) => owner && (row.noShowCount ?? 0) > 0,
        run: input.onResetNoShows,
      },
    ],
    bulkActions: owner
      ? [
          {
            id: 'activate',
            label: t('customers.markActive'),
            consequence: t('customers.bulkActivateConfirm'),
            run: (rows) => input.onBulkSetActive(rows, true),
          },
          {
            id: 'deactivate',
            label: t('customers.markInactive'),
            consequence: t('customers.bulkDeactivateConfirm'),
            run: (rows) => input.onBulkSetActive(rows, false),
          },
        ]
      : [],
  };
}
