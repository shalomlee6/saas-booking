import React from 'react';

interface BusinessHeaderProps {
  businessName: string;
  subtitle?: string;
  logoUrl?: string;
}

export const BusinessHeader: React.FC<BusinessHeaderProps> = ({
  businessName,
  subtitle = 'קבעי תור בקלות',
  logoUrl,
}) => {
  return (
    <header className="businessHeader">
      <div className="businessHeader__content">
        {logoUrl ? (
          <img src={logoUrl} alt={businessName} className="businessHeader__logo" />
        ) : (
          <div className="businessHeader__logoPlaceholder">
            {businessName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="businessHeader__text">
          <h1 className="businessHeader__name">{businessName}</h1>
          {subtitle && <p className="businessHeader__subtitle">{subtitle}</p>}
        </div>
      </div>
    </header>
  );
};

