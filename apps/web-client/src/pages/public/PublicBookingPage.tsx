import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { BusinessHeader } from '../../components/public/BusinessHeader';
import { ServicePicker } from '../../components/public/ServicePicker';
import { MobileSlots } from '../../components/public/MobileSlots';
import { BookingSheet } from '../../components/public/BookingSheet';
import { getPublicBusiness, getPublicServices, getPublicAvailableSlots } from '../../api/publicClient';
import { useClientAuth } from '../../public/clientAuth/ClientAuthContext';
import { applyTheme } from '../../utils/applyTheme';

interface Service {
  id: string;
  name: string;
  colorHex: string;
  durationMin: number;
  price?: number;
}

interface Slot {
  id: string;
  date: Date;
  time: string;
  available: boolean;
  start: string;
  end: string;
}

export const PublicBookingPage: React.FC = () => {
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const { customerId } = useClientAuth();
  const [businessName, setBusinessName] = useState('העסק');
  const [loadingBusiness, setLoadingBusiness] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [isBookingSheetOpen, setIsBookingSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load business
  useEffect(() => {
    const loadBusiness = async () => {
      if (!businessSlug) return;
      try {
        setLoadingBusiness(true);
        const business = await getPublicBusiness(businessSlug);
        setBusinessName(business.name);
        
        // Apply theme from settings if available
        if (business.settings?.theme) {
          applyTheme({ theme: business.settings.theme });
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
        const data = await getPublicServices(businessSlug);
        setServices(
          data.map((s: any) => ({
            id: s.id,
            name: s.name,
            colorHex: s.colorHex || '#FF9DBC',
            durationMin: s.durationMin || 60,
            price: s.price,
          }))
        );
      } catch (err) {
        console.error('Failed to load services:', err);
        setError('שגיאה בטעינת השירותים');
      } finally {
        setLoadingServices(false);
      }
    };
    loadServices();
  }, [businessSlug]);

  // Load slots when service is selected
  useEffect(() => {
    const loadSlots = async () => {
      if (!selectedServiceId || !businessSlug) return;

      try {
        setLoadingSlots(true);
        setError(null);
        // customerId is now optional - API will return estimated slots if not provided
        const availableSlots = await getPublicAvailableSlots(
          businessSlug,
          selectedServiceId,
          customerId || undefined
        );

        const transformedSlots: Slot[] = availableSlots.map((slot: any) => {
          const startDate = new Date(slot.start);
          const timeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;

          return {
            id: slot.start,
            date: startDate,
            time: timeStr,
            available: slot.isAvailable !== false,
            start: slot.start,
            end: slot.end,
          };
        });

        setSlots(transformedSlots);
      } catch (err: any) {
        console.error('Failed to load slots:', err);
        setError('שגיאה בטעינת הזמנים הזמינים');
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    if (selectedServiceId) {
      loadSlots();
    }
  }, [selectedServiceId, businessSlug, customerId]);

  // Note: Slots will automatically reload when customerId changes due to the dependency in the main useEffect above

  const handleServiceSelect = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setSelectedSlotId(null);
  };

  const handleSlotSelect = (slotId: string) => {
    setSelectedSlotId(slotId);
    setIsBookingSheetOpen(true);
  };


  const handleBookingSuccess = () => {
    setIsBookingSheetOpen(false);
    // Navigate to confirmation page
    window.location.href = `/public/${businessSlug}/confirmed`;
  };

  const selectedService = services.find((s) => s.id === selectedServiceId);
  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  if (loadingBusiness) {
    return (
      <div className="publicBookingPage">
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
          טוען...
        </div>
      </div>
    );
  }

  return (
    <div className="publicBookingPage">
      <BusinessHeader businessName={businessName} subtitle="קבעי תור בקלות" />

      <main className="publicBookingPage__content">
        {error && (
          <div className="publicBookingPage__error">
            {error}
            <button
              className="publicBookingPage__retry"
              onClick={() => window.location.reload()}
            >
              נסי שוב
            </button>
          </div>
        )}

        {/* Step 1: Service Selection */}
        {!selectedServiceId && (
          <div className="publicBookingPage__step">
            <h2 className="publicBookingPage__stepTitle">בחרי שירות</h2>
            {loadingServices ? (
              <div className="servicePicker__skeleton">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="serviceCard serviceCard--skeleton" />
                ))}
              </div>
            ) : (
              <ServicePicker
                services={services}
                selectedServiceId={selectedServiceId}
                onSelect={handleServiceSelect}
              />
            )}
          </div>
        )}

        {/* Step 2: Slot Selection */}
        {selectedServiceId && (
          <div className="publicBookingPage__step">
            <div className="publicBookingPage__stepHeader">
              <h2 className="publicBookingPage__stepTitle">בחרי תאריך ושעה</h2>
              <button
                className="publicBookingPage__back"
                onClick={() => {
                  setSelectedServiceId(null);
                  setSelectedSlotId(null);
                }}
              >
                ← חזרה
              </button>
            </div>
            <MobileSlots
              slots={slots}
              selectedSlotId={selectedSlotId}
              onSelect={handleSlotSelect}
              loading={loadingSlots}
            />
            {!customerId && slots.length > 0 && (
              <div className="publicBookingPage__authPrompt" style={{ marginTop: '16px' }}>
                <p className="publicBookingPage__authPromptSubtext" style={{ fontSize: '13px', margin: 0 }}>
                  הזמנים המוצגים הם משוערים. לאחר אימות הטלפון, יוצגו הזמנים המדויקים עבורך.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Booking Sheet */}
      {selectedService && selectedSlot && businessSlug && (
        <BookingSheet
          isOpen={isBookingSheetOpen}
          onClose={() => {
            setIsBookingSheetOpen(false);
            // If it was a temp slot, clear it
            if (selectedSlotId === 'temp') {
              setSelectedSlotId(null);
            }
          }}
          onSuccess={handleBookingSuccess}
          service={selectedService}
          slot={selectedSlot}
          businessSlug={businessSlug}
        />
      )}
    </div>
  );
};

