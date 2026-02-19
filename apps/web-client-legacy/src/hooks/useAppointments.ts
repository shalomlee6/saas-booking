import { useState, useEffect, useRef } from 'react';
import { fetchWeekAppointments } from '../api/appointments';
import type { AppointmentDto } from '../types/api-types';

export function useWeekAppointments() {
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Guard against React StrictMode double-invocation in dev
  const didFetchRef = useRef(false);

  // useEffect(() => {
  //   // Prevent duplicate fetch in React StrictMode
  //   if (didFetchRef.current) return;
  //   didFetchRef.current = true;

  //   const loadAppointments = async () => {
  //     try {
  //       setLoading(true);
  //       setError(null);
  //       const data = await fetchWeekAppointments();
  //       setAppointments(data);
  //     } catch (err) {
  //       console.error('Failed to fetch appointments', err);
  //       setError('נכשלה טעינת התורים');
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  //   loadAppointments();
  // }, []);

  return { appointments, loading, error };
}

