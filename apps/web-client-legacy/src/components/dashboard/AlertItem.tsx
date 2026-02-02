import React from 'react';

interface AlertItemProps {
  message: string;
  type?: 'info' | 'warning';
}

export const AlertItem: React.FC<AlertItemProps> = ({ message, type = 'info' }) => {
  const dotColor = type === 'warning' ? 'var(--pink-500)' : 'var(--mint-400)';
  
  return (
    <div className="listItem">
      <div className="colorDot" style={{ backgroundColor: dotColor }} />
      <div className="itemMain">
        <div className="itemTop">
          <span>{message}</span>
        </div>
      </div>
    </div>
  );
};

