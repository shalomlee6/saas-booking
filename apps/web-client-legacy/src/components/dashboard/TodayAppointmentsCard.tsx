import React from 'react';
import type { AppointmentDto } from '../../types/api-types';
import { AppointmentListItem } from './AppointmentListItem';

interface TodayAppointmentsCardProps {
  appointments: AppointmentDto[];
}

export const TodayAppointmentsCard: React.FC<TodayAppointmentsCardProps> = ({ appointments }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayAppointments = appointments
    .filter((apt) => {
      const aptDate = new Date(apt.start);
      return aptDate >= today && aptDate < tomorrow;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 6);

  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <div className="cardTitle">תורים היום</div>
          <div className="cardSub">{todayAppointments.length} תורים</div>
        </div>
      </div>
      {todayAppointments.length > 0 ? (
        <div className="list">
          {todayAppointments.map((apt) => (
            <AppointmentListItem key={apt._id} appointment={apt} />
          ))}
        </div>
      ) : (
        <div className="emptyState">אין תורים היום</div>
      )}
    </div>
  );
};

