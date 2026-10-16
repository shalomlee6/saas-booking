import { APPOINTMENT_LIST_SORT_FIELDS } from '../../model/appointment-list-row';
import {
  appointmentAllowsCancel,
  appointmentAllowsNoShow,
  buildAppointmentTableConfig,
} from './appointment-list.config';

const BACKEND_SORT_ALLOWLIST = [
  'start',
  'price',
  'duration',
  'customerName',
  'status',
  'serviceName',
];

describe('appointment list config', () => {
  const config = buildAppointmentTableConfig({
    t: (key) => key,
    locale: 'en',
    services: [{ value: 'svc-1', label: 'Haircut' }],
    onView: () => undefined,
    onEdit: () => undefined,
    onNoShow: () => undefined,
    onCancel: () => undefined,
    onCreate: () => undefined,
  });

  it('uses only sort fields the appointments API allowlist accepts', () => {
    expect(BACKEND_SORT_ALLOWLIST.length).toBe(APPOINTMENT_LIST_SORT_FIELDS.length);
    for (const field of APPOINTMENT_LIST_SORT_FIELDS) {
      expect(BACKEND_SORT_ALLOWLIST.includes(field)).toBeTrue();
    }
    for (const sort of config.sorts) {
      expect(BACKEND_SORT_ALLOWLIST.includes(sort.field)).toBeTrue();
    }
  });

  it('keeps quick filters on the toolbar and the rest in the drawer', () => {
    const queue = config.filters.find((filter) => filter.id === 'queue');
    expect(queue?.placement).toBe('quick');
    expect(config.filters.filter((filter) => filter.id !== 'queue').every((filter) => filter.placement === 'drawer')).toBeTrue();
    expect(config.defaultFilters).toEqual({ queue: 'all', date: 'upcoming' });
    expect(config.permissions).toEqual({ metrics: false, bulk: false, export: false });
    expect(config.bulkActions).toEqual([]);
  });

  it('offers no-show and cancel only where the status policy allows', () => {
    const now = Date.parse('2026-10-04T12:00:00.000Z');
    const past = '2026-10-04T10:00:00.000Z';
    const future = '2026-10-04T14:00:00.000Z';
    expect(appointmentAllowsNoShow('confirmed', past, now)).toBeTrue();
    expect(appointmentAllowsNoShow('completed', past, now)).toBeTrue();
    expect(appointmentAllowsNoShow('confirmed', future, now)).toBeFalse();
    expect(appointmentAllowsNoShow('pending', past, now)).toBeFalse();
    expect(appointmentAllowsNoShow('cancelled', past, now)).toBeFalse();
    expect(appointmentAllowsNoShow('no_show', past, now)).toBeFalse();
    expect(appointmentAllowsCancel('pending')).toBeTrue();
    expect(appointmentAllowsCancel('confirmed')).toBeTrue();
    expect(appointmentAllowsCancel('completed')).toBeFalse();
    expect(appointmentAllowsCancel('cancelled')).toBeFalse();
    expect(appointmentAllowsCancel('no_show')).toBeFalse();

    const noShow = config.rowActions.find((action) => action.id === 'no-show');
    const cancel = config.rowActions.find((action) => action.id === 'cancel');
    const ended = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const later = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const row = {
      _id: '1',
      customerName: 'Ada',
      customerPhone: '',
      customerPreferredTimeOfDay: null,
      serviceId: null,
      serviceName: 'Cut',
      start: ended,
      end: ended,
      duration: 30,
      price: 80,
      status: 'confirmed',
      source: 'owner',
      notes: '',
    };
    expect(noShow?.visible?.({ ...row, status: 'pending' })).toBeFalse();
    expect(noShow?.visible?.({ ...row, end: later })).toBeFalse();
    expect(cancel?.visible?.({ ...row, status: 'completed' })).toBeFalse();
    expect(cancel?.visible?.(row)).toBeTrue();
    expect(cancel?.confirmText).toBe('appointments.cancelConfirmQuestion');
  });
});