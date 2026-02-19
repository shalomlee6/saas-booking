import React from 'react';

interface Service {
  _id: string;
  name: string;
  colorHex?: string;
  durationMinutes: number;
  price?: number;
}

interface ServiceCategoryPickerProps {
  services: Service[];
  selectedServiceId: string | null;
  onSelect: (serviceId: string) => void;
  loading?: boolean;
}

// Service icons mapping (simple emoji/unicode for now)
const getServiceIcon = (serviceName: string, colorHex?: string): string => {
  const name = serviceName.toLowerCase();
  if (name.includes('מניקור') || name.includes('manicure')) return '💅';
  if (name.includes('פדיקור') || name.includes('pedicure')) return '🦶';
  if (name.includes('בניה') || name.includes('nail')) return '✨';
  if (name.includes('עיסוי') || name.includes('massage')) return '🌸';
  if (name.includes('שיער') || name.includes('hair')) return '💇';
  if (name.includes('עיצוב') || name.includes('design')) return '🎨';
  return '💆';
};

export const ServiceCategoryPicker: React.FC<ServiceCategoryPickerProps> = ({
  services,
  selectedServiceId,
  onSelect,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="serviceCategoryPicker">
        <div className="serviceCategoryPicker__skeleton">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="serviceCategoryCard serviceCategoryCard--skeleton" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="serviceCategoryPicker">
      <h2 className="serviceCategoryPicker__title">בחרי שירות</h2>
      <div className="serviceCategoryPicker__grid">
        {services.map((service) => {
          const isSelected = selectedServiceId === service._id;
          const icon = getServiceIcon(service.name, service.colorHex);
          const color = service.colorHex || '#FF9DBC';

          return (
            <div
              key={service._id}
              className={`serviceCategoryCard ${isSelected ? 'serviceCategoryCard--selected' : ''}`}
              onClick={() => onSelect(service._id)}
              style={{
                borderColor: isSelected ? color : undefined,
                backgroundColor: isSelected ? `${color}15` : undefined,
              }}
            >
              <div
                className="serviceCategoryCard__icon"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {icon}
              </div>
              <div className="serviceCategoryCard__content">
                <div className="serviceCategoryCard__name">{service.name}</div>
                <div className="serviceCategoryCard__details">
                  <span className="serviceCategoryCard__duration">{service.durationMinutes} דקות</span>
                  {service.price && service.price > 0 && (
                    <>
                      <span className="serviceCategoryCard__separator">•</span>
                      <span className="serviceCategoryCard__price">₪{service.price}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

