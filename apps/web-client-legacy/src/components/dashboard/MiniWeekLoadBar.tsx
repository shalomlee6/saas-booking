import React from 'react';

interface MiniWeekLoadBarProps {
  dayLabel: string;
  count: number;
  maxCount: number;
}

export const MiniWeekLoadBar: React.FC<MiniWeekLoadBarProps> = ({ dayLabel, count, maxCount }) => {
  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
  const height = Math.max(percentage, 8); // Minimum 8% height for visibility

  return (
    <div className="weekBar">
      <div
        className="weekBarFill"
        style={{ height: `${height}%`, minHeight: count > 0 ? '8px' : '0' }}
      />
      <div className="weekBarLabel">{dayLabel}</div>
      <div className="weekBarLabel" style={{ fontSize: '11px', marginTop: '2px', fontWeight: 600 }}>
        {count}
      </div>
    </div>
  );
};

