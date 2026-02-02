import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { BusinessHero } from '../../components/public/BusinessHero';
import { ServiceCategoryPicker } from '../../components/public/ServiceCategoryPicker';
import { OtpModal } from '../../components/public/OtpModal';
import { getPublicBusiness, getPublicServices } from '../../api/publicClient';
import { applyTheme } from '../../utils/applyTheme';

interface Service {
  _id: string;
  name: string;
  colorHex?: string;
  durationMinutes: number;
  price?: number;
}

// API response format
interface ServiceApiResponse {
  id: string;
  name: string;
  colorHex: string;
  durationMin: number;
  price?: number;
}

export const PublicLandingPage: React.FC = () => {
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const [business, setBusiness] = useState<{ name: string; tagline?: string; logo?: string } | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [loadingBusiness, setLoadingBusiness] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load business data
  useEffect(() => {
    const loadBusiness = async () => {
      if (!businessSlug) return;
      try {
        setLoadingBusiness(true);
        const businessData = await getPublicBusiness(businessSlug);
        setBusiness({
          name: businessData.name || 'העסק',
          tagline: businessData.tagline || 'קביעת תור בקלות ובנוחות',
          logo: businessData.logo,
        });

        // Apply theme from settings if available
        if (businessData.settings?.theme) {
          applyTheme({ theme: businessData.settings.theme });
        }
      } catch (err) {
        console.error('Failed to load business:', err);
        setError('שגיאה בטעינת פרטי העסק');
      } finally {
        setLoadingBusiness(false);
      }
    };
    loadBusiness();
  }, [businessSlug]);

  // Load services
  useEffect(() => {
    const loadServices = async () => {
      if (!businessSlug) return;
      try {
        setLoadingServices(true);
        const servicesData = await getPublicServices(businessSlug);
        setServices(servicesData.map((s: ServiceApiResponse) => ({
          _id: s.id, // API returns 'id', we use '_id' internally
          name: s.name,
          colorHex: s.colorHex || '#FF9DBC',
          durationMinutes: s.durationMin || 60, // API returns 'durationMin'
          price: s.price || 0,
        })));
      } catch (err) {
        console.error('Failed to load services:', err);
        setError('שגיאה בטעינת השירותים');
      } finally {
        setLoadingServices(false);
      }
    };
    loadServices();
  }, [businessSlug]);

  const handleServiceSelect = (serviceId: string) => {
    setSelectedServiceId(serviceId);
  };

  const handleBookClick = () => {
    if (selectedServiceId) {
      setIsOtpModalOpen(true);
    }
  };

  const handleOtpSuccess = () => {
    // After successful OTP, navigate to booking page
    // The OtpModal will handle navigation
  };

  if (loadingBusiness) {
    return (
      <div className="publicLanding">
        <div className="publicLanding__loading">טוען...</div>
      </div>
    );
  }

  return (
    <div className="publicLanding">
      <div className="publicLanding__background" />
      <div className="publicLanding__container">
        {business && (
          <BusinessHero
            logo={business.logo}
            businessName={business.name}
            tagline={business.tagline}
            rating={4.5}
          />
        )}

        <ServiceCategoryPicker
          services={services}
          selectedServiceId={selectedServiceId}
          onSelect={handleServiceSelect}
          loading={loadingServices}
        />

        {error && (
          <div className="publicLanding__error">
            {error}
          </div>
        )}

        <div className="publicLanding__cta">
          <button
            className={`pill pill--primary pill--large ${!selectedServiceId ? 'pill--disabled' : ''}`}
            onClick={handleBookClick}
            disabled={!selectedServiceId}
          >
            קבעי תור עכשיו
          </button>
        </div>
      </div>

      <OtpModal
        isOpen={isOtpModalOpen}
        onClose={() => setIsOtpModalOpen(false)}
        onSuccess={handleOtpSuccess}
        selectedServiceId={selectedServiceId}
      />
    </div>
  );
};

