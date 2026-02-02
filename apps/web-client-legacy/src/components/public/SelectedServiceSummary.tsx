import React from 'react';

interface Service {
  id: string;
  name: string;
  colorHex: string;
  durationMin: number;
  price?: number;
}

interface SelectedServiceSummaryProps {
  service: Service;
}

export const SelectedServiceSummary: React.FC<SelectedServiceSummaryProps> = ({ service }) => {
  return (
    <div className="selectedServiceSummary">
      <div className="selectedServiceSummary__header">
        <div
          className="selectedServiceSummary__colorDot"
          style={{ backgroundColor: service.colorHex }}
        />
        <h3 className="selectedServiceSummary__title">שירות נבחר</h3>
      </div>
      <div className="selectedServiceSummary__content">
        <div className="selectedServiceSummary__name">{service.name}</div>
        <div className="selectedServiceSummary__details">
          <span>{service.durationMin} דקות</span>
          {service.price && service.price > 0 && (
            <>
              <span className="selectedServiceSummary__separator">•</span>
              <span>₪{service.price}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

