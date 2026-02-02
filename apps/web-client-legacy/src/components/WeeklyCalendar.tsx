import React from 'react';
import type { AppointmentDto } from '../types/api-types';

interface WeeklyCalendarProps {
  appointments: AppointmentDto[];
}

export const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({ appointments }) => {
  // Generate 7 days starting from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() + i);
    days.push(day);
  }

  // Generate hours from 08:00 to 20:00
  const hours: number[] = [];
  for (let h = 8; h < 20; h++) {
    hours.push(h);
  }

  // Helper function to find appointments that overlap with a time slot
  const getAppointmentsForSlot = (day: Date, hour: number): AppointmentDto[] => {
    const slotStart = new Date(day);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(day);
    slotEnd.setHours(hour + 1, 0, 0, 0);

    return appointments.filter((apt) => {
      const aptStart = new Date(apt.start);
      const aptEnd = new Date(apt.end);
      
      // Check if appointment overlaps with this slot
      return aptStart < slotEnd && aptEnd > slotStart;
    });
  };

  // Format day header
  const formatDayHeader = (date: Date): string => {
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const dayName = dayNames[date.getDay()];
    const dayNum = date.getDate();
    const month = date.getMonth() + 1;
    return `${dayName} ${dayNum}/${month}`;
  };

  // Get background color for appointment
  const getAppointmentColor = (appointment: AppointmentDto): string => {
    return appointment.service?.colorHex || '#c084fc'; // Default light purple
  };

  // Format appointment display text
  const formatAppointmentText = (appointment: AppointmentDto): string => {
    const serviceName = appointment.service?.name || '';
    const customerName = appointment.customer?.name || '';
    if (serviceName && customerName) {
      return `${serviceName} • ${customerName}`;
    }
    return serviceName || customerName || '';
  };

  // Get theme color for appointment (rotate through theme colors if no service color)
  const getThemeAppointmentColor = (index: number): string => {
    // Use actual color values, not CSS variables, for inline styles
    const colors = [
      'rgba(243, 82, 113, 0.25)', // appt-pink
      'rgba(108, 214, 205, 0.30)', // appt-mint
      'rgba(166, 223, 248, 0.45)', // appt-sky
      'rgba(255, 157, 188, 0.40)', // appt-hot
    ];
    return colors[index % colors.length];
  };

  // Format appointment time range
  const formatAppointmentTime = (appointment: AppointmentDto): string => {
    const start = new Date(appointment.start);
    const end = new Date(appointment.end);
    const startHour = start.getHours();
    const startMin = start.getMinutes();
    const endHour = end.getHours();
    const endMin = end.getMinutes();
    
    const formatHour = (h: number, m: number): string => {
      const period = h >= 12 ? 'pm' : 'am';
      const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const minutes = m > 0 ? `:${m.toString().padStart(2, '0')}` : '';
      return `${displayHour}${minutes} ${period}`;
    };
    
    return `${formatHour(startHour, startMin)} - ${formatHour(endHour, endMin)}`;
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="weekTable">
        <thead>
          <tr>
            <th className="weekHeadCell">שעה</th>
            {days.map((day, idx) => (
              <th key={idx} className="weekHeadCell">
                {formatDayHeader(day)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hours.map((hour) => (
            <tr key={hour}>
              <td className="timeCell">
                {hour}:00
              </td>
              {days.map((day, dayIdx) => {
                const slotAppointments = getAppointmentsForSlot(day, hour);
                const hasAppointments = slotAppointments.length > 0;
                
                if (hasAppointments) {
                  // Show the first appointment (or multiple if they overlap)
                  const firstAppt = slotAppointments[0];
                  const serviceColor = firstAppt.service?.colorHex;
                  const bgColor = serviceColor || getThemeAppointmentColor(dayIdx);
                  const textColor = firstAppt.service?.textColorHex || '#111827';
                  
                  return (
                    <td
                      key={dayIdx}
                      className="slotCell slotCellBusy"
                      title={formatAppointmentText(firstAppt)}
                    >
                      <div className="apptBlock" style={{ backgroundColor: bgColor, color: textColor }}>
                        <div className="apptBlock__time">{formatAppointmentTime(firstAppt)}</div>
                        <div className="apptBlock__customer">{firstAppt.customer?.name || 'לקוחה'}</div>
                        <div className="apptBlock__service">{firstAppt.service?.name || 'שירות'}</div>
                      </div>
                    </td>
                  );
                } else {
                  return (
                    <td
                      key={dayIdx}
                      className="slotCell slotCellEmpty"
                    />
                  );
                }
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
