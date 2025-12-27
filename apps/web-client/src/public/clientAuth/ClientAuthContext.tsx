import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ClientAuthContextType {
  isClientAuthed: boolean;
  customerId: string | null;
  businessId: string | null;
  loginWithToken: (token: string, customerId: string, businessId: string) => void;
  logout: () => void;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export const ClientAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isClientAuthed, setIsClientAuthed] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);

  useEffect(() => {
    // Check localStorage on mount
    const token = localStorage.getItem('sb_client_token');
    const storedCustomerId = localStorage.getItem('sb_client_customerId');
    const storedBusinessId = localStorage.getItem('sb_client_businessId');

    if (token && storedCustomerId && storedBusinessId) {
      setIsClientAuthed(true);
      setCustomerId(storedCustomerId);
      setBusinessId(storedBusinessId);
    }
  }, []);

  const loginWithToken = (token: string, customerId: string, businessId: string) => {
    localStorage.setItem('sb_client_token', token);
    localStorage.setItem('sb_client_customerId', customerId);
    localStorage.setItem('sb_client_businessId', businessId);
    setIsClientAuthed(true);
    setCustomerId(customerId);
    setBusinessId(businessId);
  };

  const logout = () => {
    localStorage.removeItem('sb_client_token');
    localStorage.removeItem('sb_client_customerId');
    localStorage.removeItem('sb_client_businessId');
    setIsClientAuthed(false);
    setCustomerId(null);
    setBusinessId(null);
  };

  return (
    <ClientAuthContext.Provider
      value={{
        isClientAuthed,
        customerId,
        businessId,
        loginWithToken,
        logout,
      }}
    >
      {children}
    </ClientAuthContext.Provider>
  );
};

export const useClientAuth = () => {
  const context = useContext(ClientAuthContext);
  if (context === undefined) {
    throw new Error('useClientAuth must be used within a ClientAuthProvider');
  }
  return context;
};

