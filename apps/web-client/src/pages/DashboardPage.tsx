import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import type { AppointmentDto, Customer } from '../types/api-types';
import { useNavigate } from 'react-router-dom';
import { AppointmentsWeekPage } from './AppointmentsWeekPage';

import { CustomersPage } from './CustomersPage';
import { fetchWeekAppointments } from '../api/appointments';

export const DashboardPage: React.FC = () => {
  const { user, business, loading, logout } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const didFetchLoadAppointmentsRef = useRef(false);

  const navigate = useNavigate();

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
      } finally {
        setLoadingCustomers(false);
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


    loadAppointments();
    didFetchLoadAppointmentsRef.current = true;

  }, [user]);


  if (loading) return <div>טוען...</div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow px-4 py-3 flex items-center justify-between">
        <div>
          <div className="font-semibold">
            שלום {user.email}
          </div>
          {business && (
            <div className="text-sm text-slate-600">
              עסק: {business.name}
            </div>
          )}
        </div>
        <div className="space-x-2">
          <button
            onClick={() => navigate('/public')}
            className="px-3 py-1 border rounded text-sm"
          >
            צפייה באתר הלקוחות
          </button>
          <button
            onClick={logout}
            className="px-3 py-1 bg-red-500 text-white rounded text-sm"
          >
            התנתקות
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">

          
          <div className="flex flex-col gap-4">

            <div className="flex flex-col">
              <h1 className="text-xl font-bold mb-2">לקוחות</h1>
              {loadingCustomers ? (
                <div>טוען לקוחות...</div>
              ) : (
                <CustomersPage customersList={customers} />
              )}
            </div>

            <div className="flex flex-col">
              {loadingAppointments ? (
              <div>טוען תורים השבוע...</div>
              ) : (
                <AppointmentsWeekPage showSideBar={false} appointments={appointments} customersList={customers} />
              )}
            </div>
          </div>

          
          
      </main>
      
    </div>
  );
};
