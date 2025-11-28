import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import type { Customer } from '../types/api-types';
import { CustomersTable } from '../components/CustomersTable';
import { useNavigate } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { user, business, loading, logout } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
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
        <h1 className="text-xl font-bold mb-2">לקוחות</h1>
        {loadingCustomers ? (
          <div>טוען לקוחות...</div>
        ) : (
          <CustomersTable customers={customers} />
        )}
      </main>
    </div>
  );
};
