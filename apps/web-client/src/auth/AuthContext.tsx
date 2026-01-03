import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Business, BusinessSettingsDto } from '../types/api-types';
import { api } from '../api/client';
import { getMySettings } from '../api/settings';
import { applyTheme } from '../utils/applyTheme';

interface AuthContextValue {
  user: User | null;
  business: Business | null;
  settings: BusinessSettingsDto | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [settings, setSettings] = useState<BusinessSettingsDto | null>(null);
  const [loading, setLoading] = useState(true);

  // טעינה ראשונית מה-localStorage
  useEffect(() => {


    const loadUser = async () => {
      try {
        const res = await api.get('/auth/me');
        if(!res) {
          setUser(null);
          setBusiness(null);
          setSettings(null);
          setLoading(false);
          return;
        }
        setUser(res.data?.user);
        setBusiness(res.data?.business);

        // Load settings and apply theme
        if (res.data?.user) {
          try {
            const settingsData = await getMySettings();
            setSettings(settingsData);
            applyTheme(settingsData);
          } catch (err) {
            console.error('Failed to load settings:', err);
            // Don't block if settings fail to load
          }
        }
      } catch {
        setUser(null);
        setBusiness(null);
        setSettings(null);
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

    // Load settings and apply theme after login
    if (res.data?.user) {
      try {
        const settingsData = await getMySettings();
        setSettings(settingsData);
        applyTheme(settingsData);
      } catch (err) {
        console.error('Failed to load settings after login:', err);
        // Don't block if settings fail to load
      }
    }
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
    setBusiness(null);
    setSettings(null);
    // Reset theme to defaults (optional - you might want to keep theme until page reload)
  };

  return (
    <AuthContext.Provider value={{ user, business, settings, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
