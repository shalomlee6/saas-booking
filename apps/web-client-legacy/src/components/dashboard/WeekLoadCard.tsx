import React from 'react';
import type { AppointmentDto } from '../../types/api-types';
import { MiniWeekLoadBar } from './MiniWeekLoadBar';

interface WeekLoadCardProps {
  appointments: AppointmentDto[];
}

export const WeekLoadCard: React.FC<WeekLoadCardProps> = ({ appointments }) => {
  const dayNames = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  const dayNamesFull = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Count appointments per day for the next 7 days
  const dayCounts: number[] = [];
  let maxCount = 0;

  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(today);
    dayStart.setDate(today.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const count = appointments.filter((apt) => {
      const aptDate = new Date(apt.start);
      return aptDate >= dayStart && aptDate < dayEnd;
    }).length;

    dayCounts.push(count);
    maxCount = Math.max(maxCount, count);
  }

  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <div className="cardTitle">סקירת שבוע</div>
          <div className="cardSub">7 הימים הקרובים</div>
        </div>
      </div>
      <div className="weekBars">
        {dayCounts.map((count, idx) => (
          <MiniWeekLoadBar
            key={idx}
            dayLabel={dayNames[idx]}
            count={count}
            maxCount={maxCount}
          />
        ))}
      </div>
    </div>
  );
};

