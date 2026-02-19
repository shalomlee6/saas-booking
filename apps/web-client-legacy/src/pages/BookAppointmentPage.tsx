import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useServices } from '../hooks/useServices';
import { fetchAvailableSlots } from '../api/appointments';
import { AvailableSlotsTable } from '../components/AvailableSlotsTable';
import type { AvailableSlotDto } from '../types/api-types';

const TEMP_CUSTOMER_ID = 'REPLACE_WITH_REAL_CUSTOMER_ID';

export const BookAppointmentPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { services, loading: servicesLoading } = useServices();

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlotDto[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const customerId = (user as any).customerId;
  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [authLoading, user, navigate]);

  const handleLoadSlots = async () => {
    if (!selectedServiceId) {
      alert('אנא בחר שירות תחילה');
      return;
    }
    if (!customerId) {
      alert('אנא בחר לקוח תחילה');
      return;
    }

    try {
      setLoadingSlots(true);
      const slots = await fetchAvailableSlots(selectedServiceId, customerId);
      setAvailableSlots(slots);
    } catch (err) {
      console.error('Failed to fetch available slots', err);
      alert('נכשלה טעינת התורים הזמינים');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSelectSlot = (slot: AvailableSlotDto) => {
    console.log('Selected slot', slot);
  };

  if (authLoading || servicesLoading) {
    return <div className="p-4">טוען...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-right">קביעת תור</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="mb-4">
            <label className="block mb-2 text-right font-semibold">בחר שירות</label>
            <select
              value={selectedServiceId || ''}
              onChange={(e) => setSelectedServiceId(e.target.value || null)}
              className="w-full border rounded px-3 py-2 text-right"
            >
              <option value="">-- בחר שירות --</option>
              {services.map((service) => (
                <option key={service._id} value={service._id}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleLoadSlots}
            disabled={!selectedServiceId || loadingSlots}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            הצג תורים פנויים
          </button>
        </div>

        {loadingSlots && (
          <div className="text-center p-4">טוען תורים זמינים...</div>
        )}

        {!loadingSlots && availableSlots.length > 0 && (
          <AvailableSlotsTable slots={availableSlots} onSelectSlot={handleSelectSlot} />
        )}

        {!loadingSlots && availableSlots.length === 0 && selectedServiceId && (
          <div className="text-center p-4 text-slate-600">
            לא נמצאו תורים זמינים לשבוע הקרוב
          </div>
        )}
      </div>
    </div>
  );
};

