import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AppointmentsWeekPage } from './AppointmentsWeekPage';
import { fetchWeekAppointments } from '../api/appointments';
import type { AppointmentDto, Customer } from '../types/api-types';
import { api } from '../api/client';

export const DashboardHomePage: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const didFetchLoadAppointmentsRef = useRef(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await api.get<Customer[]>('/customers');
        setCustomers(res.data);
      } catch (err) {
        console.error('Failed to fetch customers', err);
      }
    };
    fetchCustomers();
  }, []);

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

  if (loading) return <div>טוען...</div>;
  if (!user) return null;

  return (
    <>
      {/* {loadingAppointments ? (
        <section className="dashContent">
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
            טוען תורים השבוע...
          </div>
        </section>
      ) : (
        <AppointmentsWeekPage showSideBar={false} appointments={appointments} customersList={customers} />
      )} */}
      {/* <h1>shalom</h1> */}
    </>
  );
};

