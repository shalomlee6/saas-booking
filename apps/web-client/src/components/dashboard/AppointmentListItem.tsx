import React from 'react';
import type { AppointmentDto } from '../../types/api-types';

interface AppointmentListItemProps {
  appointment: AppointmentDto;
}

export const AppointmentListItem: React.FC<AppointmentListItemProps> = ({ appointment }) => {
  const start = new Date(appointment.start);
  const timeStr = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`;
  
  const serviceColor = appointment.service?.colorHex || 'var(--pink-500)';
  const customerName = appointment.customer?.name || 'לקוחה';
  const serviceName = appointment.service?.name || 'שירות';

  return (
    <div className="listItem">
      <div className="colorDot" style={{ backgroundColor: serviceColor }} />
      <div className="itemMain">
        <div className="itemTop">
          <span>{customerName}</span>
          <span>{timeStr}</span>
        </div>
        <div className="itemBottom">{serviceName}</div>
      </div>
    </div>
  );
};

