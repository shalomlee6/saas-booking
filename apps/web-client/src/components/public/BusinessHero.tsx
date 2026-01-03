import React from 'react';

interface BusinessHeroProps {
  logo?: string;
  businessName: string;
  tagline?: string;
  rating?: number;
}

export const BusinessHero: React.FC<BusinessHeroProps> = ({
  logo,
  businessName,
  tagline,
  rating = 4.5,
}) => {
  return (
    <div className="businessHero">
      {logo ? (
        <img src={logo} alt={businessName} className="businessHero__logo" />
      ) : (
        <div className="businessHero__logoPlaceholder">
          <span className="businessHero__logoText">{businessName.charAt(0)}</span>
        </div>
      )}
      <h1 className="businessHero__name">{businessName}</h1>
      {tagline && <p className="businessHero__tagline">{tagline}</p>}
      {rating > 0 && (
        <div className="businessHero__rating">
          <span className="businessHero__ratingStars">
            {'★'.repeat(Math.floor(rating))}
            {rating % 1 >= 0.5 && '½'}
            {'☆'.repeat(5 - Math.ceil(rating))}
          </span>
          <span className="businessHero__ratingValue">{rating.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
};

