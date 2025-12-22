import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { WeeklyCalendar } from '../components/WeeklyCalendar';
import { useServices } from '../hooks/useServices';
import type { AppointmentDto, Customer } from '../types/api-types';
type AppointmentsWeekPageProps = {
  showSideBar: boolean;
  appointments: AppointmentDto[];
  customersList?: Customer[];
};
export const AppointmentsWeekPage: React.FC<AppointmentsWeekPageProps> = ({showSideBar,appointments,customersList}) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { services, loading: servicesLoading } = useServices();

  
  // const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | 'all'>('all');
  const [selectedServiceId, setSelectedServiceId] = useState<string | 'all'>('all');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [authLoading, user, navigate]);

  // useEffect(() => {
  //   const loadAppointments = async () => {
  //     try {
  //       setLoadingAppointments(true);
  //       const data = await fetchWeekAppointments();
  //       setAppointments(data);
  //     } catch (err) {
  //       console.error('Failed to fetch appointments', err);
  //     } finally {
  //       setLoadingAppointments(false);
  //     }
  //   };

  //   if (user) {
  //     loadAppointments();
  //   }
  // }, [user]);

  // Filter appointments based on selected filters
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      if (selectedCustomerId !== 'all' && apt.customer?._id !== selectedCustomerId) {
        return false;
      }
      if (selectedServiceId !== 'all' && apt.service?._id !== selectedServiceId) {
        return false;
      }
      return true;
    });
  }, [appointments, selectedCustomerId, selectedServiceId]);

  const handleClearFilters = () => {
    setSelectedCustomerId('all');
    setSelectedServiceId('all');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-right">תורים לשבוע הקרוב</h1>
        
        <div className="flex gap-4">
          {/* Filter Panel - Right side (RTL) */}
          {showSideBar && <div className="w-64 flex-shrink-0 bg-white rounded-lg shadow p-4 border border-slate-200">
            <h2 className="text-lg font-semibold mb-4 text-right">סינון</h2>
            
            <div className="space-y-4">
              {/* Customer Filter */}
              <div>
                <label className="block mb-2 text-right text-sm font-medium">לפי לקוחה</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value as string | 'all')}
                  className="w-full border rounded px-3 py-2 text-right text-sm"
                >
                  <option value="all">הכל</option>
                  {customersList?.map((customer) => (
                    <option key={customer._id} value={customer._id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

                {/* Service Filter */}
                <div>
                  <label className="block mb-2 text-right text-sm font-medium">לפי סוג תור</label>
                  <select
                    value={selectedServiceId}
                    onChange={(e) => setSelectedServiceId(e.target.value as string | 'all')}
                    className="w-full border rounded px-3 py-2 text-right text-sm"
                  >
                    <option value="all">הכל</option>
                    {services.map((service) => (
                      <option key={service._id} value={service._id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Clear Filters Button */}
                <button
                  onClick={handleClearFilters}
                  className="w-full px-4 py-2 bg-slate-200 text-slate-800 rounded hover:bg-slate-300 text-sm font-medium"
                >
                  נקה סינון
                </button>
              </div>
            </div>
          }

          {/* Calendar Area */}
          <div className="flex-1">
            <WeeklyCalendar appointments={filteredAppointments} />
          </div>
        </div>
      </div>
    </div>
  );
};
