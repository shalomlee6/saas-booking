import { SERVICE_LIST_SORT_FIELDS } from '../../model/service-list-row';
import { buildServiceTableConfig } from './service-list.config';

const BACKEND_SORT_ALLOWLIST = [
  'name',
  'price',
  'duration',
  'bookings',
  'revenue',
  'averageActualPrice',
  'revenuePerHour',
  'lastBooking',
  'createdAt',
];

describe('service list config', () => {
  const config = buildServiceTableConfig({
    t: (key, params) => (params ? `${key}:${params['count'] ?? ''}` : key),
    locale: 'en',
    owner: true,
    onView: () => undefined,
    onEdit: () => undefined,
    onSetActive: () => undefined,
    onCreate: () => undefined,
    onBulkSetActive: () => undefined,
  });

  it('uses only sort fields the services API allowlist accepts', () => {
    expect(BACKEND_SORT_ALLOWLIST.length).toBe(SERVICE_LIST_SORT_FIELDS.length);
    for (const field of SERVICE_LIST_SORT_FIELDS) {
      expect(BACKEND_SORT_ALLOWLIST.includes(field)).toBeTrue();
    }
    for (const sort of config.sorts) {
      expect(BACKEND_SORT_ALLOWLIST.includes(sort.field)).toBeTrue();
    }
  });

  it('sends every activity preset and half-open range params', () => {
    const activity = config.filters.find((filter) => filter.id === 'activity');
    const bookings = config.filters.find((filter) => filter.id === 'bookings');
    const price = config.filters.find((filter) => filter.id === 'price');
    if (activity?.kind !== 'preset' || bookings?.kind !== 'preset' || price?.kind !== 'preset') {
      fail('expected preset filters');
      return;
    }
    expect(activity.options.map((option) => option.params)).toEqual([
      { activity: 'neverBooked' },
      { activity: 'noBookingsIn30' },
      { activity: 'noBookingsIn60' },
      { activity: 'noBookingsIn90' },
    ]);
    expect(bookings.options.find((option) => option.value === '1-10')?.params).toEqual({
      bookingsMin: '1',
      bookingsMax: '11',
    });
    expect(price.options.find((option) => option.value === '0-100')?.params).toEqual({
      priceMin: '0',
      priceMax: '100',
    });
    expect(price.options.find((option) => option.value === '350+')?.params).toEqual({ priceMin: '350' });
  });

  it('builds the deactivate confirmation from the future appointment count', () => {
    const deactivate = config.rowActions.find((action) => action.id === 'deactivate');
    expect(typeof deactivate?.confirmText).toBe('function');
    if (typeof deactivate?.confirmText !== 'function') return;
    expect(
      deactivate.confirmText({
        _id: '1',
        name: 'Cut',
        duration: 30,
        isActive: true,
        upcomingAppointments: 4,
      })
    ).toBe('services.deactivateConfirm:4');
  });
});
