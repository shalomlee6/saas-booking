import { nextAgendaAppointmentId } from './dashboard.component';

describe('dashboard next row', () => {
  const now = new Date('2026-06-15T12:00:00.000Z').getTime();
  const later = new Date('2026-06-15T13:00:00.000Z');

  it('skips no-show and completed visits and marks the next pending or confirmed visit', () => {
    const id = nextAgendaAppointmentId(
      [
        { _id: 'done', end: later, status: 'completed' },
        { _id: 'missed', end: later, status: 'no_show' },
        { _id: 'cancelled', end: later, status: 'cancelled' },
        { _id: 'next', end: later, status: 'confirmed' },
        { _id: 'after', end: new Date('2026-06-15T15:00:00.000Z'), status: 'pending' },
      ],
      now
    );
    expect(id).toBe('next');
  });
});
