import { formatJerusalemDate } from '../../../../shared/data-management/calendar-date';
import type {
  DataFilter,
  DataPresetOption,
  EntityDataManagementConfig,
} from '../../../../shared/data-management/entity-data-management-config';
import { SERVICE_LIST_SORT_FIELDS, type ServiceListRow } from '../../model/service-list-row';

const METRIC_SORTS = new Set<string>([
  'bookings',
  'revenue',
  'averageActualPrice',
  'revenuePerHour',
  'lastBooking',
]);

const METRIC_COLUMNS = new Set([
  'bookings',
  'revenue',
  'completedBookings',
  'averageActualPrice',
  'revenuePerHour',
  'lastBooking',
]);

export interface ServiceListConfigInput {
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: string;
  owner: boolean;
  onView: (row: ServiceListRow) => void;
  onEdit: (row: ServiceListRow) => void;
  onSetActive: (row: ServiceListRow, isActive: boolean) => void;
  onCreate: () => void;
  onBulkSetActive: (rows: ServiceListRow[], isActive: boolean) => void;
}

function money(value: number | undefined, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function excerpt(value: string | undefined): string {
  const text = (value ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return '';
  return text.length > 80 ? `${text.slice(0, 79)}…` : text;
}

export function buildServiceTableConfig(
  input: ServiceListConfigInput
): EntityDataManagementConfig<ServiceListRow> {
  const { t, locale, owner } = input;
  const columns: EntityDataManagementConfig<ServiceListRow>['columns'] = [
    {
      id: 'name',
      header: t('services.columnService'),
      visibility: 'default',
      showOnSmallScreen: true,
      avatar: true,
      value: (row) => row.name,
      secondary: (row) => excerpt(row.description),
    },
    {
      id: 'duration',
      header: t('services.duration'),
      visibility: 'default',
      showOnSmallScreen: true,
      align: 'end',
      numeric: true,
      value: (row) => `${row.duration} ${t('services.minutesSuffix')}`,
    },
    {
      id: 'price',
      header: t('services.price'),
      visibility: 'default',
      showOnSmallScreen: true,
      align: 'end',
      numeric: true,
      value: (row) => money(row.price, locale),
    },
    {
      id: 'bookings',
      header: t('services.columnBookings'),
      visibility: 'default',
      showOnSmallScreen: true,
      align: 'end',
      numeric: true,
      value: (row) => String(row.bookings ?? 0),
    },
    {
      id: 'revenue',
      header: t('services.columnRevenue'),
      visibility: 'default',
      showOnSmallScreen: false,
      align: 'end',
      numeric: true,
      value: (row) => money(row.revenue, locale),
    },
    {
      id: 'isActive',
      header: t('services.columnStatus'),
      visibility: 'default',
      showOnSmallScreen: true,
      value: (row) => (row.isActive ? t('services.statusActive') : t('services.statusInactive')),
      tags: (row) => [
        row.isActive
          ? { label: t('services.statusActive'), severity: 'success' }
          : { label: t('services.statusInactive'), severity: 'secondary' },
      ],
    },
    {
      id: 'completedBookings',
      header: t('services.columnCompleted'),
      visibility: 'optional',
      showOnSmallScreen: false,
      align: 'end',
      numeric: true,
      value: (row) => String(row.completedBookings ?? 0),
    },
    {
      id: 'averageActualPrice',
      header: t('services.columnAverage'),
      visibility: 'optional',
      showOnSmallScreen: false,
      align: 'end',
      numeric: true,
      value: (row) => money(row.averageActualPrice, locale),
    },
    {
      id: 'revenuePerHour',
      header: t('services.columnRevenuePerHour'),
      visibility: 'optional',
      showOnSmallScreen: false,
      align: 'end',
      numeric: true,
      value: (row) => money(row.revenuePerHour, locale),
    },
    {
      id: 'lastBooking',
      header: t('services.columnLastBooking'),
      visibility: 'optional',
      showOnSmallScreen: false,
      value: (row) => formatJerusalemDate(row.lastBooking),
    },
    {
      id: 'createdAt',
      header: t('services.columnCreated'),
      visibility: 'optional',
      showOnSmallScreen: false,
      value: (row) => formatJerusalemDate(row.createdAt),
    },
  ];
  const visibleColumns = owner ? columns : columns.filter((column) => !METRIC_COLUMNS.has(column.id));
  const sorts = SERVICE_LIST_SORT_FIELDS.filter((field) => owner || !METRIC_SORTS.has(field)).map((field) => ({
    field,
    label: t(`services.sort.${field}`),
  }));

  const pricePresets: DataPresetOption[] = [
    { value: '0-100', label: '₪0–100', params: { priceMin: '0', priceMax: '100' } },
    { value: '100-200', label: '₪100–200', params: { priceMin: '100', priceMax: '200' } },
    { value: '200-350', label: '₪200–350', params: { priceMin: '200', priceMax: '350' } },
    { value: '350+', label: '₪350+', params: { priceMin: '350' } },
  ];
  const durationPresets: DataPresetOption[] = [
    { value: 'lt30', label: '<30', params: { durationMax: '30' } },
    { value: '30-60', label: '30–60', params: { durationMin: '30', durationMax: '60' } },
    { value: '60-90', label: '60–90', params: { durationMin: '60', durationMax: '90' } },
    { value: '90-120', label: '90–120', params: { durationMin: '90', durationMax: '120' } },
    { value: '120+', label: '120+', params: { durationMin: '120' } },
  ];
  const bookingPresets: DataPresetOption[] = [
    { value: '0', label: '0', params: { bookingsMax: '1' } },
    { value: '1-10', label: '1–10', params: { bookingsMin: '1', bookingsMax: '11' } },
    { value: '11-25', label: '11–25', params: { bookingsMin: '11', bookingsMax: '26' } },
    { value: '26-50', label: '26–50', params: { bookingsMin: '26', bookingsMax: '51' } },
    { value: '50+', label: '50+', params: { bookingsMin: '50' } },
  ];
  const revenuePresets: DataPresetOption[] = [
    { value: '0-500', label: '₪0–500', params: { revenueMin: '0', revenueMax: '500' } },
    { value: '500-1000', label: '₪500–1,000', params: { revenueMin: '500', revenueMax: '1000' } },
    { value: '1000-2500', label: '₪1,000–2,500', params: { revenueMin: '1000', revenueMax: '2500' } },
    { value: '2500+', label: '₪2,500+', params: { revenueMin: '2500' } },
  ];
  const activityPresets: DataPresetOption[] = [
    { value: 'neverBooked', label: t('services.activityNever'), params: { activity: 'neverBooked' } },
    { value: 'noBookingsIn30', label: t('services.activityOver30'), params: { activity: 'noBookingsIn30' } },
    { value: 'noBookingsIn60', label: t('services.activityOver60'), params: { activity: 'noBookingsIn60' } },
    { value: 'noBookingsIn90', label: t('services.activityOver90'), params: { activity: 'noBookingsIn90' } },
  ];

  const filters: DataFilter[] = [
    {
      id: 'status',
      label: t('services.columnStatus'),
      kind: 'segment',
      placement: 'quick',
      options: [
        { value: 'active', label: t('services.statusActiveGroup') },
        { value: 'inactive', label: t('services.statusInactiveGroup') },
        { value: 'all', label: t('services.statusAll') },
      ],
    },
    { id: 'price', label: t('services.pricePreset'), kind: 'preset', placement: 'drawer', options: pricePresets },
    {
      id: 'duration',
      label: t('services.durationPreset'),
      kind: 'preset',
      placement: 'drawer',
      options: durationPresets,
    },
  ];
  if (owner) {
    filters.push(
      { id: 'bookings', label: t('services.bookingsPreset'), kind: 'preset', placement: 'drawer', options: bookingPresets },
      { id: 'revenue', label: t('services.revenuePreset'), kind: 'preset', placement: 'drawer', options: revenuePresets },
      { id: 'activity', label: t('services.activity'), kind: 'preset', placement: 'drawer', options: activityPresets }
    );
  }

  return {
    title: t('services.title'),
    countLabel: (total) =>
      total === 1 ? t('services.countOne') : `${new Intl.NumberFormat(locale).format(total)} ${t('services.countSuffix')}`,
    empty: {
      icon: 'pi pi-briefcase',
      title: t('services.emptyTitle'),
      hint: t('services.emptyText'),
      actionLabel: t('services.addFirst'),
    },
    rowId: (row) => row._id,
    columns: visibleColumns,
    searchFields: ['name', 'description'],
    searchPlaceholder: t('services.searchPlaceholder'),
    filters,
    sorts,
    defaultFilters: { status: 'active' },
    primaryAction: { label: t('services.newService'), icon: 'pi pi-plus', run: input.onCreate },
    onRowClick: input.onView,
    permissions: { metrics: owner, bulk: owner, export: owner },
    rowActions: [
      { id: 'view', label: t('common.view'), icon: 'pi pi-eye', severity: 'secondary', run: input.onView },
      { id: 'edit', label: t('common.edit'), icon: 'pi pi-pencil', severity: 'primary', run: input.onEdit },
      {
        id: 'deactivate',
        label: t('services.deactivateAction'),
        icon: 'pi pi-ban',
        severity: 'danger',
        confirmText: (row) => t('services.deactivateConfirm', { count: row.upcomingAppointments ?? 0 }),
        visible: (row) => row.isActive,
        run: (row) => input.onSetActive(row, false),
      },
      {
        id: 'activate',
        label: t('services.activateAction'),
        icon: 'pi pi-check',
        severity: 'success',
        visible: (row) => !row.isActive,
        run: (row) => input.onSetActive(row, true),
      },
    ],
    bulkActions: owner
      ? [
          {
            id: 'activate',
            label: t('services.activateAction'),
            consequence: t('services.bulkActivateConfirm'),
            run: (rows) => input.onBulkSetActive(rows, true),
          },
          {
            id: 'deactivate',
            label: t('services.deactivateAction'),
            consequence: t('services.bulkDeactivateConfirm'),
            run: (rows) => input.onBulkSetActive(rows, false),
          },
        ]
      : [],
  };
}
