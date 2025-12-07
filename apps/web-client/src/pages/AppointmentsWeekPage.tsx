import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { WeeklyCalendar, type AppointmentDto } from '../components/WeeklyCalendar';
import { useNavigate } from 'react-router-dom';

interface BackendAppointment {
  _id: string;
  start: string | Date;
  end: string | Date;
  customerId?: {
    name: string;
    phone: string;
  } | string;
  serviceId?: {
    name: string;
  } | string;
}

export const AppointmentsWeekPage: React.FC = () => {
  const { user, loading } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const res = await api.get<BackendAppointment[]>('/appointments/week');
        
        // Map backend response to AppointmentDto
        const mappedAppointments: AppointmentDto[] = res.data.map((apt) => {
          const customerName = 
            typeof apt.customerId === 'object' && apt.customerId !== null
              ? apt.customerId.name
              : undefined;
          
          const treatmentType =
            typeof apt.serviceId === 'object' && apt.serviceId !== null
              ? apt.serviceId.name
              : undefined;

          return {
            _id: apt._id,
            start: apt.start,
            end: apt.end,
            customerName,
            treatmentType,
          };
        });

        setAppointments(mappedAppointments);
      } catch (err) {
        console.error('Failed to fetch appointments', err);
      } finally {
        setLoadingAppointments(false);
      }
    };

    if (user) {
      fetchAppointments();
    }
  }, [user]);

  if (loading || loadingAppointments) {
    return <div className="p-4">טוען...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-right">תורים לשבוע הקרוב</h1>
        <WeeklyCalendar appointments={appointments} />
      </div>
    </div>
  );
};

