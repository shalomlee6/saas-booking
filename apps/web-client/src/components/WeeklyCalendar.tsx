import React from 'react';

export interface AppointmentDto {
  _id: string;
  start: string | Date;
  end: string | Date;
  customerName?: string;
  treatmentType?: string;
}

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

  // Generate hours from 08:00 to 17:00
  const hours: number[] = [];
  for (let h = 8; h <= 17; h++) {
    hours.push(h);
  }

  // Helper function to check if a time slot has an appointment
  const hasAppointment = (day: Date, hour: number): boolean => {
    const slotStart = new Date(day);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(day);
    slotEnd.setHours(hour + 1, 0, 0, 0);

    return appointments.some((apt) => {
      const aptStart = new Date(apt.start);
      const aptEnd = new Date(apt.end);
      
      // Check if appointment overlaps with this slot
      return aptStart < slotEnd && aptEnd > slotStart;
    });
  };

  // Format day header
  const formatDayHeader = (date: Date): string => {
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const dayName = days[date.getDay()];
    const dayNum = date.getDate();
    const month = date.getMonth() + 1;
    return `${dayName} ${dayNum}/${month}`;
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
                const isBooked = hasAppointment(day, hour);
                return (
                  <td
                    key={dayIdx}
                    className={`border border-slate-300 p-2 ${
                      isBooked ? 'bg-purple-300 slot-booked' : 'bg-white slot-free'
                    }`}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

