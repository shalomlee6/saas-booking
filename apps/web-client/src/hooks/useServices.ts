import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import type { ServiceDto } from '../types/api-types';

export function useServices() {
  const [services, setServices] = useState<ServiceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Guard against React StrictMode double-invocation in dev
  const didFetchRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate fetch in React StrictMode
    if (didFetchRef.current) return;
    didFetchRef.current = true;

    const fetchServices = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get<ServiceDto[]>('/services');
        setServices(res.data);
      } catch (err) {
        console.error('Failed to fetch services', err);
        setError('נכשלה טעינת השירותים');
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  return { services, loading, error };
}

