import React from 'react';
import type { AvailableSlotDto } from '../types/api-types';

interface AvailableSlotsTableProps {
  slots: AvailableSlotDto[];
  onSelectSlot?: (slot: AvailableSlotDto) => void;
}

export const AvailableSlotsTable: React.FC<AvailableSlotsTableProps> = ({
  slots,
  onSelectSlot,
}) => {
  // Compute the week range based on the minimal start date in slots, or use today
  let startOfWeek: Date;
  if (slots.length > 0) {
    const minDate = new Date(Math.min(...slots.map((s) => new Date(s.start).getTime())));
    startOfWeek = new Date(minDate);
    startOfWeek.setHours(0, 0, 0, 0);
  } else {
    startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
  }

  // Generate 7 days starting from startOfWeek
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    days.push(day);
  }

  // Generate time slots from 08:00 to 20:00 in 30-minute steps
  const timeSlots: { hour: number; minute: number }[] = [];
  for (let hour = 8; hour < 20; hour++) {
    timeSlots.push({ hour, minute: 0 });
    timeSlots.push({ hour, minute: 30 });
  }

  // Format day header
  const formatDayHeader = (date: Date): string => {
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const dayName = dayNames[date.getDay()];
    const dayNum = date.getDate();
    const month = date.getMonth() + 1;
    return `${dayName} ${dayNum}/${month}`;
  };

  // Format time
  const formatTime = (hour: number, minute: number): string => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  // Find slot for a specific day and time
  const findSlot = (day: Date, hour: number, minute: number): AvailableSlotDto | undefined => {
    const slotDate = new Date(day);
    slotDate.setHours(hour, minute, 0, 0);

    return slots.find((slot) => {
      const slotStart = new Date(slot.start);
      return (
        slotStart.getFullYear() === slotDate.getFullYear() &&
        slotStart.getMonth() === slotDate.getMonth() &&
        slotStart.getDate() === slotDate.getDate() &&
        slotStart.getHours() === slotDate.getHours() &&
        slotStart.getMinutes() === slotDate.getMinutes()
      );
    });
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="slots-table w-full border-collapse border border-slate-300">
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
          {timeSlots.map((timeSlot, timeIdx) => (
            <tr key={timeIdx}>
              <td className="slots-time-cell border border-slate-300 p-2 bg-slate-50 font-semibold text-right">
                {formatTime(timeSlot.hour, timeSlot.minute)}
              </td>
              {days.map((day, dayIdx) => {
                const slot = findSlot(day, timeSlot.hour, timeSlot.minute);
                if (slot) {
                  return (
                    <td
                      key={dayIdx}
                      className={`slots-slot-cell slots-slot-cell--available border border-slate-300 p-2 bg-purple-200 hover:bg-purple-300 cursor-pointer transition-colors`}
                      onClick={() => onSelectSlot?.(slot)}
                    />
                  );
                } else {
                  return (
                    <td
                      key={dayIdx}
                      className="border border-slate-300 p-2 bg-white"
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

