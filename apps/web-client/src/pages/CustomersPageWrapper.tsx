import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { CustomersPage } from './CustomersPage';
import { api } from '../api/client';
import type { Customer } from '../types/api-types';

export const CustomersPageWrapper: React.FC = () => {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [authLoading, user, navigate]);

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

  if (authLoading || loadingCustomers) {
    return (
      <section className="dashContent">
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
          טוען לקוחות...
        </div>
      </section>
    );
  }

  if (!user) return null;

  return (
    <section className="dashContent">
      <CustomersPage customersList={customers} />
    </section>
  );
};

