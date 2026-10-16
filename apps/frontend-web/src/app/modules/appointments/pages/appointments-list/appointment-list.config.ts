import { formatJerusalemDate, formatJerusalemTime } from '../../../../shared/data-management/calendar-date';
import type {
  DataFilterOption,
  DataPresetOption,
  EntityDataManagementConfig,
} from '../../../../shared/data-management/entity-data-management-config';
import type { AppointmentListRow } from '../../model/appointment-list-row';

const STATUS_KEYS: Record<string, string> = {
  pending: 'status.pending',
  confirmed: 'status.confirmed',
  completed: 'status.completed',
  cancelled: 'status.cancelled',
  no_show: 'status.no_show',
};

const STATUS_SEVERITY: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
  confirmed: 'success',
  pending: 'warn',
  completed: 'info',
  cancelled: 'danger',
  no_show: 'warn',
};

/** Same rule as the calendar: confirmed or completed, and the appointment has already ended. */
export function appointmentAllowsNoShow(status: string, end: string, now = Date.now()): boolean {
  const normalized = status.toLowerCase();
  if (normalized !== 'confirmed' && normalized !== 'completed') return false;
  const endMs = new Date(end).getTime();
  return !Number.isNaN(endMs) && endMs < now;
}

/** Cancel is offered only while the appointment is still pending or confirmed. */
export function appointmentAllowsCancel(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized === 'pending' || normalized === 'confirmed';
}

export interface AppointmentListConfigInput {
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: string;
  services: readonly DataFilterOption[];
  onView: (row: AppointmentListRow) => void;
  onEdit: (row: AppointmentListRow) => void;
  onNoShow: (row: AppointmentListRow) => void;
  onCancel: (row: AppointmentListRow) => void;
  onCreate: () => void;
}

function money(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export function buildAppointmentTableConfig(
  input: AppointmentListConfigInput
): EntityDataManagementConfig<AppointmentListRow> {
  const { t, locale } = input;
  const pricePresets: DataPresetOption[] = [
    { value: '0-100', label: '₪0–100', params: { priceMin: '0', priceMax: '100' } },
    { value: '100-200', label: '₪100–200', params: { priceMin: '100', priceMax: '200' } },
    { value: '200-350', label: '₪200–350', params: { priceMin: '200', priceMax: '350' } },
    { value: '350+', label: '₪350+', params: { priceMin: '350' } },
  ];
  const timePresets: DataPresetOption[] = [
    { value: 'morning', label: t('timeOfDay.morning'), params: { timeOfDay: 'morning' } },
    { value: 'afternoon', label: t('timeOfDay.afternoon'), params: { timeOfDay: 'afternoon' } },
    { value: 'evening', label: t('timeOfDay.evening'), params: { timeOfDay: 'evening' } },
    { value: 'night', label: t('timeOfDay.night'), params: { timeOfDay: 'night' } },
  ];
  const statuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];

  return {
    title: t('appointments.title'),
    countLabel: (total) =>
      total === 1
        ? t('appointments.countOne')
        : `${new Intl.NumberFormat(locale).format(total)} ${t('appointments.countSuffix')}`,
    empty: {
      icon: 'pi pi-calendar',
      title: t('appointments.emptyTitle'),
      hint: t('appointments.emptyHint'),
      actionLabel: t('appointments.newAppointment'),
    },
    rowId: (row) => row._id,
    searchFields: ['customerName', 'customerPhone', 'serviceName'],
    searchPlaceholder: t('appointments.listSearchPlaceholder'),
    defaultFilters: { queue: 'all', date: 'upcoming' },
    primaryAction: { label: t('appointments.newAppointment'), icon: 'pi pi-plus', run: input.onCreate },
    onRowClick: input.onView,
    permissions: { metrics: false, bulk: false, export: false },
    columns: [
      {
        id: 'customerName',
        header: t('appointments.customer'),
        visibility: 'default',
        showOnSmallScreen: true,
        avatar: true,
        value: (row) => row.customerName || '—',
        secondary: (row) => row.customerPhone || '',
      },
      {
        id: 'serviceName',
        header: t('appointments.service'),
        visibility: 'default',
        showOnSmallScreen: true,
        value: (row) => row.serviceName || '—',
      },
      {
        id: 'start',
        header: t('appointments.dateLabel'),
        visibility: 'default',
        showOnSmallScreen: true,
        numeric: true,
        value: (row) => formatJerusalemDate(row.start),
      },
      {
        id: 'time',
        header: t('appointments.columnTime'),
        visibility: 'default',
        showOnSmallScreen: true,
        numeric: true,
        value: (row) => {
          const start = formatJerusalemTime(row.start);
          const end = formatJerusalemTime(row.end);
          const text = start && end ? `${start}–${end}` : start;
          return text ? `\u2066${text}\u2069` : '';
        },
      },
      {
        id: 'duration',
        header: t('appointments.columnDuration'),
        visibility: 'default',
        showOnSmallScreen: false,
        align: 'end',
        numeric: true,
        value: (row) => `${row.duration} ${t('appointments.minutesSuffix')}`,
      },
      {
        id: 'price',
        header: t('appointments.price'),
        visibility: 'default',
        showOnSmallScreen: true,
        align: 'end',
        numeric: true,
        value: (row) => money(row.price, locale),
      },
      {
        id: 'status',
        header: t('appointments.status'),
        visibility: 'default',
        showOnSmallScreen: true,
        value: (row) => {
          const key = STATUS_KEYS[row.status];
          return key ? t(key) : row.status;
        },
        tags: (row) => {
          const key = STATUS_KEYS[row.status];
          return [
            {
              label: key ? t(key) : row.status,
              severity: STATUS_SEVERITY[row.status] ?? 'secondary',
            },
          ];
        },
      },
      {
        id: 'source',
        header: t('appointments.columnSource'),
        visibility: 'default',
        showOnSmallScreen: false,
        value: (row) =>
          row.source === 'client-online' ? t('appointments.sourceOnline') : t('appointments.sourceOwner'),
      },
    ],
    filters: [
      {
        id: 'queue',
        label: t('appointments.status'),
        kind: 'segment',
        placement: 'quick',
        options: [
          { value: 'all', label: t('appointments.queueAll') },
          { value: 'pending', label: t('appointments.queuePending') },
          { value: 'unmarked', label: t('appointments.queueUnmarked') },
        ],
      },
      {
        id: 'date',
        label: t('appointments.datePreset'),
        kind: 'date-preset',
        placement: 'drawer',
        fromId: 'startFrom',
        toId: 'startTo',
        options: [
          { value: 'upcoming', label: t('appointments.dateUpcoming') },
          { value: 'today', label: t('appointments.today') },
          { value: 'thisWeek', label: t('appointments.dateThisWeek') },
          { value: 'thisMonth', label: t('appointments.dateThisMonth') },
          { value: 'last30', label: t('appointments.dateLast30') },
          { value: 'custom', label: t('appointments.dateCustom') },
        ],
      },
      {
        id: 'status',
        label: t('appointments.status'),
        kind: 'select',
        placement: 'drawer',
        options: statuses.map((status) => ({
          value: status,
          label: t(STATUS_KEYS[status]),
        })),
      },
      {
        id: 'service',
        label: t('appointments.service'),
        kind: 'select',
        placement: 'drawer',
        options: [...input.services],
      },
      {
        id: 'source',
        label: t('appointments.columnSource'),
        kind: 'select',
        placement: 'drawer',
        options: [
          { value: 'owner', label: t('appointments.sourceOwner') },
          { value: 'client-online', label: t('appointments.sourceOnline') },
        ],
      },
      {
        id: 'price',
        label: t('appointments.pricePreset'),
        kind: 'preset',
        placement: 'drawer',
        options: pricePresets,
      },
      {
        id: 'timeOfDay',
        label: t('appointments.timePreset'),
        kind: 'preset',
        placement: 'drawer',
        options: timePresets,
      },
    ],
    sorts: [
      { field: 'start', label: t('appointments.sort.start') },
      { field: 'price', label: t('appointments.sort.price') },
      { field: 'duration', label: t('appointments.sort.duration') },
      { field: 'customerName', label: t('appointments.sort.customerName') },
      { field: 'status', label: t('appointments.sort.status') },
      { field: 'serviceName', label: t('appointments.sort.serviceName') },
    ],
    rowActions: [
      { id: 'view', label: t('common.view'), icon: 'pi pi-eye', severity: 'secondary', run: input.onView },
      { id: 'edit', label: t('common.edit'), icon: 'pi pi-pencil', severity: 'primary', run: input.onEdit },
      {
        id: 'no-show',
        label: t('appointments.markNoShow'),
        icon: 'pi pi-user-minus',
        severity: 'warn',
        keepSlot: true,
        visible: (row) => appointmentAllowsNoShow(row.status, row.end),
        run: input.onNoShow,
      },
      {
        id: 'cancel',
        label: t('appointments.cancelAppointment'),
        icon: 'pi pi-times',
        severity: 'danger',
        keepSlot: true,
        confirmText: t('appointments.cancelConfirmQuestion'),
        visible: (row) => appointmentAllowsCancel(row.status),
        run: input.onCancel,
      },
    ],
    bulkActions: [],
  };
}
