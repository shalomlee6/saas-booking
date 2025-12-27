import React from 'react';

interface Service {
  id: string;
  name: string;
  colorHex: string;
  durationMin: number;
}

interface ServicePickerProps {
  services: Service[];
  selectedServiceId: string | null;
  onSelect: (serviceId: string) => void;
}

export const ServicePicker: React.FC<ServicePickerProps> = ({
  services,
  selectedServiceId,
  onSelect,
}) => {
  return (
    <div className="servicePicker">
      <h3 className="servicePicker__title">בחרי שירות</h3>
      <div className="servicePicker__grid">
        {services.map((service) => (
          <div
            key={service.id}
            className={`serviceCard ${selectedServiceId === service.id ? 'serviceCard--selected' : ''}`}
            onClick={() => onSelect(service.id)}
            style={{
              borderColor: selectedServiceId === service.id ? service.colorHex : undefined,
            }}
          >
            <div
              className="serviceCard__color"
              style={{ backgroundColor: service.colorHex }}
            />
            <div className="serviceCard__content">
              <div className="serviceCard__name">{service.name}</div>
              <div className="serviceCard__duration">{service.durationMin} דקות</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

