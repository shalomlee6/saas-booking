import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useClientAuth } from '../../public/clientAuth/ClientAuthContext';
import { SelectedServiceSummary } from '../../components/public/SelectedServiceSummary';
import { SlotsWeekGrid } from '../../components/public/SlotsWeekGrid';
import { HoldToConfirmButton } from '../../components/public/HoldToConfirmButton';
import { getPublicServices, getPublicAvailableSlots, createPublicAppointment } from '../../api/publicClient';

interface Service {
  id: string;
  name: string;
  colorHex: string;
  durationMin: number;
}

interface Slot {
  id: string;
  date: Date;
  time: string;
  available: boolean;
  start: string;
  end: string;
}

export const ClientBookingPage: React.FC = () => {
  const navigate = useNavigate();
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const location = useLocation();
  const { customerId, businessId, isClientAuthed } = useClientAuth();
  
  // Get serviceId from route state (passed from landing page after OTP)
  const routeState = location.state as { serviceId?: string } | null;
  const initialServiceId = routeState?.serviceId || null;
  
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(initialServiceId);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isClientAuthed) {
      navigate(`/public/${businessSlug}/auth`);
    }
  }, [isClientAuthed, businessSlug, navigate]);

  // Load services on mount
  useEffect(() => {
    const loadServices = async () => {
      if (!businessSlug) return;
      try {
        setLoadingServices(true);
        const data = await getPublicServices(businessSlug);
        setServices(data.map((s: any) => ({
          id: s.id,
          name: s.name,
          colorHex: s.colorHex || '#FF9DBC',
          durationMin: s.durationMin || 60,
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

  // Load slots when service is selected AND user is authenticated
  useEffect(() => {
    const loadSlots = async () => {
      if (!selectedServiceId || !customerId || !businessSlug || !isClientAuthed) return;
      
      try {
        setLoadingSlots(true);
        const availableSlots = await getPublicAvailableSlots(
          businessSlug,
          selectedServiceId,
          customerId
        );

        // Transform API response to Slot format
        const transformedSlots: Slot[] = availableSlots.map((slot: any) => {
          const startDate = new Date(slot.start);
          const timeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
          
          // Use start time as unique ID
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
      } catch (err) {
        console.error('Failed to load slots:', err);
        setError('שגיאה בטעינת הזמנים הזמינים');
      } finally {
        setLoadingSlots(false);
      }
    };

    if (selectedServiceId && isClientAuthed) {
      loadSlots();
    }
  }, [selectedServiceId, customerId, businessSlug, isClientAuthed]);

  const selectedService = services.find((s) => s.id === selectedServiceId);
  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  const handleSlotSelect = (slotId: string) => {
    setSelectedSlotId(slotId);
  };

  const handleConfirm = async () => {
    if (!selectedService || !selectedSlot || !businessSlug || !customerId) return;

    try {
      setError(null);
      await createPublicAppointment(businessSlug, {
        serviceId: selectedService.id,
        customerId,
        start: selectedSlot.start,
        end: selectedSlot.end,
      });

      navigate(`/public/${businessSlug}/confirmed`, {
        state: {
          service: selectedService,
          slot: selectedSlot,
        },
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'שגיאה בקביעת התור. נסי שוב.');
      console.error('Failed to create appointment:', err);
    }
  };

  if (!isClientAuthed) {
    return (
      <div className="clientBooking">
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
          טוען...
        </div>
      </div>
    );
  }

  if (!selectedServiceId) {
    return (
      <div className="clientBooking">
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
          שגיאה: שירות לא נבחר
        </div>
      </div>
    );
  }

  return (
    <div className="clientBooking">
      <div className="clientBooking__content">
        {error && (
          <div className="otpAuth__error" style={{ marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {selectedService && (
          <SelectedServiceSummary service={selectedService} />
        )}

        <div className="clientBooking__slots">
          <h3 className="servicePicker__title">בחרי תאריך ושעה</h3>
          {loadingSlots ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
              טוען זמנים זמינים...
            </div>
          ) : slots.length === 0 ? (
            <div className="emptyState">אין זמנים זמינים. נסי שוב מאוחר יותר.</div>
          ) : (
            <SlotsWeekGrid
              slots={slots}
              selectedSlotId={selectedSlotId}
              onSelect={handleSlotSelect}
            />
          )}
        </div>

        {selectedSlot && selectedService && (
          <div className="clientBooking__confirm">
            <h3 className="servicePicker__title">אשרי את התור</h3>
            <div className="confirmSummary">
              <div className="confirmSummary__item">
                <span className="confirmSummary__label">שירות:</span>
                <span className="confirmSummary__value">{selectedService.name}</span>
              </div>
              <div className="confirmSummary__item">
                <span className="confirmSummary__label">תאריך:</span>
                <span className="confirmSummary__value">
                  {selectedSlot.date.toLocaleDateString('he-IL', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className="confirmSummary__item">
                <span className="confirmSummary__label">שעה:</span>
                <span className="confirmSummary__value">{selectedSlot.time}</span>
              </div>
              <div className="confirmSummary__item">
                <span className="confirmSummary__label">משך:</span>
                <span className="confirmSummary__value">{selectedService.durationMin} דקות</span>
              </div>
            </div>
            <HoldToConfirmButton onConfirm={handleConfirm} />
          </div>
        )}
      </div>
    </div>
  );
};

