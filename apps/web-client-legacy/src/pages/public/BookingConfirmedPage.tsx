import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

export const BookingConfirmedPage: React.FC = () => {
  const navigate = useNavigate();
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const location = useLocation();
  
  const { service, slot } = (location.state as { service?: any; slot?: any }) || {};

  const handleBookAnother = () => {
    navigate(`/public/${businessSlug}/book`);
  };

  const handleBackToHome = () => {
    navigate(`/public/${businessSlug}`);
  };

  return (
    <div className="bookingConfirmed">
      <div className="bookingConfirmed__card">
        <div className="bookingConfirmed__icon">✓</div>
        <h2 className="bookingConfirmed__title">התור נקבע בהצלחה!</h2>
        <p className="bookingConfirmed__message">קיבלנו את הבקשה שלך וניצור איתך קשר בקרוב</p>

        {service && slot && (
          <div className="confirmSummary">
            <div className="confirmSummary__item">
              <span className="confirmSummary__label">שירות:</span>
              <span className="confirmSummary__value">{service.name}</span>
            </div>
            <div className="confirmSummary__item">
              <span className="confirmSummary__label">תאריך:</span>
              <span className="confirmSummary__value">
                {new Date(slot.date).toLocaleDateString('he-IL', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
            <div className="confirmSummary__item">
              <span className="confirmSummary__label">שעה:</span>
              <span className="confirmSummary__value">{slot.time}</span>
            </div>
          </div>
        )}

        <div className="bookingConfirmed__actions">
          <button className="pill pill--primary" onClick={handleBookAnother}>
            קבעי תור נוסף
          </button>
          <button className="pill" onClick={handleBackToHome}>
            חזרה לעמוד הבית
          </button>
        </div>
      </div>
    </div>
  );
};

