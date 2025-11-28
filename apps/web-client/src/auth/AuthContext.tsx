import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Business } from '../types/api-types';
import { api } from '../api/client';

interface AuthContextValue {
  user: User | null;
  business: Business | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  // טעינה ראשונית מה-localStorage
  useEffect(() => {
    const token = localStorage.getItem('sb_token');
    const userJson = localStorage.getItem('sb_user');

    if (!token || !userJson) {
      setLoading(false);
      return;
    }

    const parsedUser: User = JSON.parse(userJson);
    setUser(parsedUser);

    // להביא business
    api
      .get<Business>('/business/me')
      .then((res: { data: any; }) => setBusiness(res.data))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<{
      token: string;
      user: User;
      business?: Business;
    }>('/auth/login', { email, password });

    const { token, user: loggedUser } = res.data;

    localStorage.setItem('sb_token', token);
    localStorage.setItem('sb_user', JSON.stringify(loggedUser));

    setUser(loggedUser);

    // להביא business
    const bizRes = await api.get<Business>('/business/me');
    setBusiness(bizRes.data);
  };

  const logout = () => {
    localStorage.removeItem('sb_token');
    localStorage.removeItem('sb_user');
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
