import React, { useState } from 'react';

interface Slot {
  id: string;
  date: Date;
  time: string;
  available: boolean;
}

interface SlotsWeekGridProps {
  slots: Slot[];
  selectedSlotId: string | null;
  onSelect: (slotId: string) => void;
}

export const SlotsWeekGrid: React.FC<SlotsWeekGridProps> = ({
  slots,
  selectedSlotId,
  onSelect,
}) => {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Group slots by day
  const slotsByDay = slots.reduce((acc, slot) => {
    const dayKey = slot.date.toISOString().split('T')[0];
    if (!acc[dayKey]) {
      acc[dayKey] = [];
    }
    acc[dayKey].push(slot);
    return acc;
  }, {} as Record<string, Slot[]>);

  const dayKeys = Object.keys(slotsByDay).sort();
  
  // Use CSS to show/hide mobile vs desktop views
  // We'll render both and let CSS handle visibility

  const activeDay = selectedDay || dayKeys[0];
  const activeSlots = slotsByDay[activeDay] || [];

  return (
    <>
      {/* Desktop: full grid */}
      <div className="slotsWeekGrid slotsWeekGrid--desktop">
        <div className="slotsWeekGrid__header">
          {dayKeys.map((dayKey) => {
            const date = new Date(dayKey);
            const dayName = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][date.getDay()];
            const dayNum = date.getDate();
            return (
              <div key={dayKey} className="slotsWeekGrid__dayHeader">
                <div>{dayName}</div>
                <div>{dayNum}</div>
              </div>
            );
          })}
        </div>
        <div className="slotsWeekGrid__body">
          {dayKeys.map((dayKey) => (
            <div key={dayKey} className="slotsWeekGrid__dayColumn">
              {slotsByDay[dayKey] && slotsByDay[dayKey].length > 0 ? (
                slotsByDay[dayKey].map((slot) => (
                  <button
                    key={slot.id}
                    className={`slotCell ${slot.available ? 'slotAvailable' : 'slotUnavailable'} ${selectedSlotId === slot.id ? 'slotCell--selected' : ''}`}
                    onClick={() => slot.available && onSelect(slot.id)}
                    disabled={!slot.available}
                  >
                    {slot.time}
                  </button>
                ))
              ) : (
                <div className="slotCell slotUnavailable" style={{ opacity: 0.3 }}>
                  אין זמנים
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: day tabs + list */}
      <div className="slotsWeekGrid slotsWeekGrid--mobile">
        <div className="slotsWeekGrid__tabs">
          {dayKeys.map((dayKey) => {
            const date = new Date(dayKey);
            const dayName = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'][date.getDay()];
            const dayNum = date.getDate();
            const isActive = activeDay === dayKey;
            
            return (
              <button
                key={dayKey}
                className={`slotsWeekGrid__tab ${isActive ? 'slotsWeekGrid__tab--active' : ''}`}
                onClick={() => setSelectedDay(dayKey)}
              >
                <div>{dayName}</div>
                <div>{dayNum}</div>
              </button>
            );
          })}
        </div>
        <div className="slotsWeekGrid__list">
          {activeSlots.map((slot) => (
            <button
              key={slot.id}
              className={`slotCell slotCell--mobile ${slot.available ? 'slotAvailable' : 'slotUnavailable'} ${selectedSlotId === slot.id ? 'slotCell--selected' : ''}`}
              onClick={() => slot.available && onSelect(slot.id)}
              disabled={!slot.available}
            >
              {slot.time}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

