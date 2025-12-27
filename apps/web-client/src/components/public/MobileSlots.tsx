import React, { useState, useMemo } from 'react';

interface Slot {
  id: string;
  date: Date;
  time: string;
  available: boolean;
  start: string;
  end: string;
}

interface MobileSlotsProps {
  slots: Slot[];
  selectedSlotId: string | null;
  onSelect: (slotId: string) => void;
  loading?: boolean;
}

export const MobileSlots: React.FC<MobileSlotsProps> = ({
  slots,
  selectedSlotId,
  onSelect,
  loading = false,
}) => {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Group slots by day
  const slotsByDay = useMemo(() => {
    const grouped: Record<string, Slot[]> = {};
    slots.forEach((slot) => {
      const dayKey = slot.date.toISOString().split('T')[0];
      if (!grouped[dayKey]) {
        grouped[dayKey] = [];
      }
      grouped[dayKey].push(slot);
    });
    return grouped;
  }, [slots]);

  const dayKeys = Object.keys(slotsByDay).sort();
  const activeDay = selectedDay || dayKeys[0] || '';
  const activeSlots = slotsByDay[activeDay] || [];

  const formatDayHeader = (dateStr: string): string => {
    const date = new Date(dateStr);
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const dayName = dayNames[date.getDay()];
    const dayNum = date.getDate();
    const month = date.getMonth() + 1;
    return `${dayName} ${dayNum}/${month}`;
  };

  const formatDayShort = (dateStr: string): string => {
    const date = new Date(dateStr);
    const dayNames = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
    return dayNames[date.getDay()];
  };

  if (loading) {
    return (
      <div className="mobileSlots">
        <div className="mobileSlots__dayTabs">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="mobileSlots__dayTab mobileSlots__dayTab--skeleton" />
          ))}
        </div>
        <div className="mobileSlots__slots">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="mobileSlots__slotSkeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (dayKeys.length === 0 && !loading) {
    return (
      <div className="mobileSlots">
        <div className="emptyState">
          {slots.length === 0
            ? 'בחרי שירות כדי לראות זמנים זמינים'
            : 'אין זמנים זמינים. נסי שוב מאוחר יותר.'}
        </div>
      </div>
    );
  }

  return (
    <div className="mobileSlots">
      {/* Day tabs */}
      <div className="mobileSlots__dayTabs">
        {dayKeys.map((dayKey) => {
          const isActive = activeDay === dayKey;
          return (
            <button
              key={dayKey}
              className={`mobileSlots__dayTab ${isActive ? 'mobileSlots__dayTab--active' : ''}`}
              onClick={() => setSelectedDay(dayKey)}
            >
              <div className="mobileSlots__dayTabName">{formatDayShort(dayKey)}</div>
              <div className="mobileSlots__dayTabDate">{new Date(dayKey).getDate()}</div>
            </button>
          );
        })}
      </div>

      {/* Day header */}
      <div className="mobileSlots__dayHeader">
        <h3 className="mobileSlots__dayTitle">{formatDayHeader(activeDay)}</h3>
      </div>

      {/* Time slots */}
      <div className="mobileSlots__slots">
        {activeSlots.length === 0 ? (
          <div className="emptyState">אין זמנים זמינים ביום זה</div>
        ) : (
          activeSlots.map((slot) => (
            <button
              key={slot.id}
              className={`mobileSlots__slot ${
                slot.available ? 'mobileSlots__slot--available' : 'mobileSlots__slot--unavailable'
              } ${selectedSlotId === slot.id ? 'mobileSlots__slot--selected' : ''}`}
              onClick={() => slot.available && onSelect(slot.id)}
              disabled={!slot.available}
            >
              {slot.time}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

