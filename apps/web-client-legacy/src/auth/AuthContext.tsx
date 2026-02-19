import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Business, BusinessSettingsDto } from '../types/api-types';
import { api } from '../api/client';
import { getMySettings } from '../api/settings';
import { applyTheme } from '../utils/applyTheme';
import { useLocation } from 'react-router-dom';

interface AuthContextValue {
  user: User | null;
  business: Business | null;
  settings: BusinessSettingsDto | null;
  authLoading: boolean;
  settingsLoading: boolean;
  isSuperAdmin: boolean;
  impersonatingBusinessId: string | null;
  initialized: boolean;
  login: (email: string, password: string) => Promise<{token: string, user: User }>;
  logout: () => Promise<void>;
  startImpersonation: (token: string, businessId: string) => void;
  stopImpersonation: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null);
  const [settings, setSettings] = useState<BusinessSettingsDto | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [impersonatingBusinessId, setImpersonatingBusinessId] = useState<string | null>(
    localStorage.getItem('sb_impersonating_businessId')
  );
  const isSuperAdmin = user?.role === 'super_admin';

  const loadSettingsIfBusiness = async (user: User | null, business: Business | null) => {
    if (!user || !business) {
      setSettings(null);
      return;
    }

    setSettingsLoading(true);
    try {
      const settingsData = await getMySettings();
      setSettings(settingsData);
      applyTheme(settingsData);
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    if (user) return; 
  
    const loadUser = async () => {
      setAuthLoading(true);
      try {
        const res = await api.get('/auth/me');
        const u = res.data?.user ?? null;
        const b = res.data?.business ?? null;
  
        setUser(u);
        setBusiness(b);
  
        setImpersonatingBusinessId(localStorage.getItem('sb_impersonating_businessId'));
  
        await loadSettingsIfBusiness(u, b);
      } catch {
        setUser(null);
        setBusiness(null);
        setSettings(null);
      } finally {
        setAuthLoading(false);
        setInitialized(true);
      }
    };
  
    loadUser();
  }, [location.pathname, user]);




  // // טעינה ראשונית מה-localStorage
  // useEffect(() => {


  //   const loadUser = async () => {
  //     try {
  //       const res = await api.get('/auth/me');
  //       if(!res) {
  //         setUser(null);
  //         setBusiness(null);
  //         setSettings(null);
  //         setLoading(false);
  //         return;
  //       }
  //       setUser(res.data?.user);
  //       setBusiness(res.data?.business);
        
  //       // Check if impersonating from localStorage
  //       const storedImpersonatingId = localStorage.getItem('sb_impersonating_businessId');
  //       if (storedImpersonatingId) {
  //         setImpersonatingBusinessId(storedImpersonatingId);
  //       }

  //       // Load settings and apply theme
  //       if (res.data?.user) {
  //         try {
  //           const settingsData = await getMySettings();
  //           setSettings(settingsData);
  //           applyTheme(settingsData);
  //         } catch (err) {
  //           console.error('Failed to load settings:', err);
  //           // Don't block if settings fail to load
  //         }
  //       }
  //     } catch {
  //       setUser(null);
  //       setBusiness(null);
  //       setSettings(null);
  //     } finally {
  //       setLoading(false);
  //     }
  //   }
  //   loadUser();
  // }, []);

  const login = async (email: string, password: string): Promise<{ token: string; user: User }> => {
    setAuthLoading(true);
    try {
      const res = await api.post<{token: string;user: User;business?: Business;}>(
        '/auth/login',
        { email, password }
      );
      if(!res.data?.user) { throw new Error('Failed to login user not found');}
      const user = res.data.user;
      const business = res.data?.business ?? null;

      setUser(user);
      setBusiness(business);
      await loadSettingsIfBusiness(user, business);
      return { token: res.data.token, user: user };
    } catch (error) {
      throw error;
    }finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    setAuthLoading(true);
    try {
      await api.post('/auth/logout');
      setUser(null);
      setBusiness(null);
      setSettings(null);
      setImpersonatingBusinessId(null);
      localStorage.removeItem('sb_token');
      localStorage.removeItem('sb_token_original');
      localStorage.removeItem('sb_impersonation_token');
      localStorage.removeItem('sb_impersonating_businessId');
    } finally {
      setAuthLoading(false);
    }
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

  return (
    <AuthContext.Provider
      value={{
        user,
        business,
        settings,
        authLoading,
        settingsLoading,
        isSuperAdmin,
        impersonatingBusinessId,
        initialized,
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
