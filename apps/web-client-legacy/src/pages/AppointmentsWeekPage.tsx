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

export const AppointmentsWeekPage: React.FC<AppointmentsWeekPageProps> = ({
  showSideBar,
  appointments,
  customersList,
}) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { services } = useServices();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | 'all'>('all');
  const [selectedServiceId, setSelectedServiceId] = useState<string | 'all'>('all');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [authLoading, user, navigate]);

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

  const handlePrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const formatCurrentDateLabel = (): string => {
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const monthNames = [
      'ינואר',
      'פברואר',
      'מרץ',
      'אפריל',
      'מאי',
      'יוני',
      'יולי',
      'אוגוסט',
      'ספטמבר',
      'אוקטובר',
      'נובמבר',
      'דצמבר',
    ];
    const dayName = dayNames[currentDate.getDay()];
    const dayNum = currentDate.getDate();
    const month = monthNames[currentDate.getMonth()];
    const year = currentDate.getFullYear();
    return `${dayName} ${dayNum} ${month}, ${year}`;
  };

  if (!user) {
    return null;
  }

  return (
    <>
      {/* Top Toolbar */}
      <header className="dashTopbar">
        {/* Left Group */}
        <div className="dashTopbar__left">
          <select className="pill">
            <option>כל השירותים</option>
            {services.map((service) => (
              <option key={service._id} value={service._id}>
                {service.name}
              </option>
            ))}
          </select>
          <select className="pill">
            <option>כל העובדים</option>
            <option>עובד 1</option>
          </select>
        </div>

        {/* Center Group */}
        <div className="dashTopbar__center">
          <button className="pill-btn" onClick={handlePrevWeek}>
            &lt;
          </button>
          <button className="pill pill--today" onClick={handleToday}>
            היום
          </button>
          <div className="date-label">{formatCurrentDateLabel()}</div>
          <button className="pill-btn" onClick={handleNextWeek}>
            &gt;
          </button>
        </div>

        {/* Right Group */}
        <div className="dashTopbar__right">
          <select className="pill" value={viewMode} onChange={(e) => setViewMode(e.target.value as 'day' | 'week')}>
            <option value="day">יום</option>
            <option value="week">שבוע</option>
          </select>
          <button className="pill pill--primary">+ תור חדש</button>
        </div>
      </header>

      {/* Content Area */}
      <section className="dashContent">
        <div className="scheduleCard">
          <div className="scheduleHeaderRow">
            <h2>לוח תורים</h2>
            <p className="muted">תצוגת שבוע</p>
          </div>
          <div className="scheduleBody">
            <WeeklyCalendar appointments={filteredAppointments} />
          </div>
        </div>
      </section>
    </>
  );
};
