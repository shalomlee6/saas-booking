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

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse border border-slate-300">
        <thead>
          <tr>
            <th className="border border-slate-300 p-2 bg-slate-100">שעה</th>
            {days.map((day, idx) => (
              <th key={idx} className="border border-slate-300 p-2 bg-slate-100 text-right">
                {formatDayHeader(day)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hours.map((hour) => (
            <tr key={hour}>
              <td className="border border-slate-300 p-2 bg-slate-50 font-semibold text-right">
                {hour}:00
              </td>
              {days.map((day, dayIdx) => {
                const slotAppointments = getAppointmentsForSlot(day, hour);
                const hasAppointments = slotAppointments.length > 0;
                
                if (hasAppointments) {
                  // Show the first appointment (or multiple if they overlap)
                  const firstAppt = slotAppointments[0];
                  const bgColor = getAppointmentColor(firstAppt);
                  const displayText = formatAppointmentText(firstAppt);
                  
                  return (
                    <td
                      key={dayIdx}
                      className="border border-slate-300 p-2 slot-booked text-right text-xs"
                      style={{ backgroundColor: bgColor }}
                      title={displayText}
                    >
                      <div className="truncate">{displayText}</div>
                    </td>
                  );
                } else {
                  return (
                    <td
                      key={dayIdx}
                      className="border border-slate-300 p-2 bg-white slot-free"
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
