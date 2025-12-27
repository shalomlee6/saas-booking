import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPublicBusiness } from '../../api/publicClient';

export const PublicBusinessLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const [businessName, setBusinessName] = useState<string>('העסק');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBusiness = async () => {
      if (!businessSlug) return;
      try {
        const business = await getPublicBusiness(businessSlug);
        setBusinessName(business.name);
      } catch (err) {
        console.error('Failed to load business:', err);
      } finally {
        setLoading(false);
      }
    };
    loadBusiness();
  }, [businessSlug]);

  const handleBookAppointment = () => {
    navigate(`/public/${businessSlug}/auth`);
  };

  if (loading) {
    return (
      <div className="publicLanding">
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
          טוען...
        </div>
      </div>
    );
  }

  return (
    <div className="publicLanding">
      <div className="publicLanding__hero">
        <h1 className="publicLanding__title">ברוכים הבאים ל{businessName}</h1>
        <p className="publicLanding__subtitle">קביעת תור בקלות ובנוחות</p>
      </div>
      <div className="publicLanding__actions">
        <button className="pill pill--primary" onClick={handleBookAppointment}>
          קבעי תור עכשיו
        </button>
      </div>
    </div>
  );
};

