import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Business } from '../types/api-types';
import { api } from '../api/client';

interface AuthContextValue {
  user: User | null;
  business: Business | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  // טעינה ראשונית מה-localStorage
  useEffect(() => {


    const loadUser = async () => {
      try {
        const res = await api.get('/auth/me');
        if(!res) {
          setUser(null);
          setBusiness(null);
          setLoading(false);
          return;
        }
        setUser(res.data?.user);
        setBusiness(res.data?.business);
      } catch {
        setUser(null);
        setBusiness(null);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<{
      token: string;
      user: User;
      business?: Business;
    }>('/auth/login', { email, password });

    setUser(res.data?.user);
    setBusiness(res.data.business ?? null);
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
    setBusiness(null);
  };

  return (
    <AuthContext.Provider value={{ user, business, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
