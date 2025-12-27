import React from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  tone?: 'pink' | 'mint' | 'sky';
}

export const KpiCard: React.FC<KpiCardProps> = ({ title, value, tone = 'pink' }) => {
  const toneClass = `kpiTone${tone.charAt(0).toUpperCase() + tone.slice(1)}`;
  
  return (
    <div className={`card ${toneClass}`}>
      <div className="cardSub">{title}</div>
      <div className="kpiValue">{value}</div>
    </div>
  );
};

