import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { fetchWeekAppointments } from '../api/appointments';
import type { AppointmentDto, User } from '../types/api-types';
import { DashboardKpiRow } from '../components/dashboard/DashboardKpiRow';
import { TodayAppointmentsCard } from '../components/dashboard/TodayAppointmentsCard';
import { AlertsCard } from '../components/dashboard/AlertsCard';
import { WeekLoadCard } from '../components/dashboard/WeekLoadCard';

export const DashboardHomePage: React.FC = () => {
  const { user,authLoading } = useAuth();
  
  const navigate = useNavigate();
  // const { businessSlug } = useParams<{ businessSlug: string }>();

  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const didFetchLoadAppointmentsRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (didFetchLoadAppointmentsRef.current) return;
    const loadAppointments = async () => {
      try {
        setLoadingAppointments(true);
        const data = await fetchWeekAppointments();
        setAppointments(data);
      } catch (err) {
        console.error('Failed to fetch appointments', err);
      } finally {
        setLoadingAppointments(false);
      }
    };

    if (user) {
      
      loadAppointments();
      didFetchLoadAppointmentsRef.current = true;
    }
  }, [user]);

  if (authLoading) return <div>טוען...</div>;
  if (!user) return null;

  // Calculate KPIs
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const todayCount = appointments.filter((apt) => {
    const aptDate = new Date(apt.start);
    return aptDate >= today && aptDate < tomorrow;
  }).length;

  // TODO: Compute monthly revenue from appointments
  const monthlyRevenue = '₪0';
  
  // TODO: Compute top service from appointments
  const topService = '—';

  if (loadingAppointments) {
    return (
      <section className="dashContent">
        <div className="dashboardHome">
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
            טוען נתונים...
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="dashContent">
      <div className="dashboardHome">
        {/* KPI Row */}
        <DashboardKpiRow
          todayCount={todayCount}
          monthlyRevenue={monthlyRevenue}
          topService={topService}
        />

        {/* Main Grid */}
        <div className="mainGrid">
          <TodayAppointmentsCard appointments={appointments} />
          <AlertsCard appointments={appointments} />
        </div>

        {/* Week Overview */}
        <WeekLoadCard appointments={appointments} />

        {/* Client Site Preview */}
        <div className="card" style={{ background: 'rgba(166, 223, 248, 0.15)' }}>
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Client Booking Site (Preview)</div>
              <div className="cardSub">See what your clients see</div>
            </div>
          </div>
          <h1>{user.role}</h1>
          <button
            className="pill pill--primary"
            onClick={() => window.open('/public/'+user.businessId, '_blank')}
            style={{ marginTop: '12px' }}
          >
            Open Client Site
          </button>
        </div>
      </div>
    </section>
  );
};
