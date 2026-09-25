import { sortUpcomingAppointments } from './upcoming-appointments.util';
import type { UpcomingAppointment } from '../services/public-api.service';

function apt(partial: Partial<UpcomingAppointment> & Pick<UpcomingAppointment, 'id' | 'date' | 'time'>): UpcomingAppointment {
  return {
    status: 'confirmed',
    serviceName: 'Manicure',
    ...partial,
  };
}

describe('sortUpcomingAppointments', () => {
  it('sorts by date then start time, soonest first', () => {
    const input = [
      apt({ id: 'c', date: '2026-09-23', time: '09:00' }),
      apt({ id: 'a', date: '2026-09-22', time: '14:00' }),
      apt({ id: 'b', date: '2026-09-22', time: '10:00' }),
    ];

    expect(sortUpcomingAppointments(input).map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('does not mutate the original array', () => {
    const input = [
      apt({ id: '2', date: '2026-09-23', time: '11:00' }),
      apt({ id: '1', date: '2026-09-22', time: '09:00' }),
    ];
    const copy = [...input];
    sortUpcomingAppointments(input);
    expect(input).toEqual(copy);
  });
});
