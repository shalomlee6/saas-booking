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
  isSuperAdmin: boolean;
  impersonatingBusinessId: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  startImpersonation: (token: string, businessId: string) => void;
  stopImpersonation: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [settings, setSettings] = useState<BusinessSettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonatingBusinessId, setImpersonatingBusinessId] = useState<string | null>(
    localStorage.getItem('sb_impersonating_businessId')
  );

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
        
        // Check if impersonating from localStorage
        const storedImpersonatingId = localStorage.getItem('sb_impersonating_businessId');
        if (storedImpersonatingId) {
          setImpersonatingBusinessId(storedImpersonatingId);
        }

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
    setImpersonatingBusinessId(null);
    localStorage.removeItem('sb_token');
    localStorage.removeItem('sb_token_original');
    localStorage.removeItem('sb_impersonation_token');
    localStorage.removeItem('sb_impersonating_businessId');
    // Reset theme to defaults (optional - you might want to keep theme until page reload)
  };

  const startImpersonation = (token: string, businessId: string) => {
    // Save original token if not already saved
    if (!localStorage.getItem('sb_token_original')) {
      const originalToken = localStorage.getItem('sb_token');
      if (originalToken) {
        localStorage.setItem('sb_token_original', originalToken);
      }
    }

    // Save impersonation token and business ID
    localStorage.setItem('sb_impersonation_token', token);
    localStorage.setItem('sb_impersonating_businessId', businessId);
    setImpersonatingBusinessId(businessId);

    // Reload user data with impersonation token
    window.location.reload();
  };

  const stopImpersonation = () => {
    // Restore original token
    const originalToken = localStorage.getItem('sb_token_original');
    if (originalToken) {
      localStorage.setItem('sb_token', originalToken);
    }

    // Clear impersonation data
    localStorage.removeItem('sb_impersonation_token');
    localStorage.removeItem('sb_impersonating_businessId');
    localStorage.removeItem('sb_token_original');
    setImpersonatingBusinessId(null);

    // Reload to refresh data
    window.location.reload();
  };

  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        business,
        settings,
        loading,
        isSuperAdmin,
        impersonatingBusinessId,
        login,
        logout,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
