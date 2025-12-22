import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import type { Customer } from '../types/api-types';

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Guard against React StrictMode double-invocation in dev
  const didFetchRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate fetch in React StrictMode
    if (didFetchRef.current) return;
    didFetchRef.current = true;

    const fetchCustomers = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get<Customer[]>('/customers');
        setCustomers(res.data);
      } catch (err) {
        console.error('Failed to fetch customers', err);
        setError('נכשלה טעינת הלקוחות');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  return { customers, loading, error };
}

