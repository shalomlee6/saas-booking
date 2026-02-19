import React from 'react';
import type { AppointmentDto } from '../../types/api-types';
import { AlertItem } from './AlertItem';

interface AlertsCardProps {
  appointments: AppointmentDto[];
}

export const AlertsCard: React.FC<AlertsCardProps> = ({ appointments }) => {
  // Derive alerts from appointments
  const alerts: string[] = [];
  
  // Check for pending appointments (if status field exists)
  // For now, we'll create a simple alert if there are many appointments today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const todayCount = appointments.filter((apt) => {
    const aptDate = new Date(apt.start);
    return aptDate >= today && aptDate < tomorrow;
  }).length;

  if (todayCount > 10) {
    alerts.push('יש לך הרבה תורים היום - כדאי לבדוק את הלו"ז');
  }

  // Placeholder: Check for appointments waiting for approval
  // This would require a status field in the appointment model
  // For now, show empty state if no alerts

  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <div className="cardTitle">התראות</div>
          <div className="cardSub">{alerts.length} התראות</div>
        </div>
      </div>
      {alerts.length > 0 ? (
        <div className="list">
          {alerts.slice(0, 5).map((alert, idx) => (
            <AlertItem key={idx} message={alert} type="info" />
          ))}
        </div>
      ) : (
        <div className="emptyState">אין התראות חדשות</div>
      )}
    </div>
  );
};

