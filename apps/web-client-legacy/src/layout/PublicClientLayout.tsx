import React, { useEffect, useState } from 'react';
import { useParams, Outlet } from 'react-router-dom';
import { getPublicBusiness } from '../api/publicClient';
import { applyTheme } from '../utils/applyTheme';

export const PublicClientLayout: React.FC = () => {
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const [businessName, setBusinessName] = useState<string>('העסק');

  useEffect(() => {
    const loadBusiness = async () => {
      if (!businessSlug) return;
      try {
        const business = await getPublicBusiness(businessSlug);
        setBusinessName(business.name);
        
        // Apply theme from settings if available
        if (business.settings?.theme) {
          applyTheme({ theme: business.settings.theme });
        }
      } catch (err) {
        console.error('Failed to load business:', err);
      }
    };
    loadBusiness();
  }, [businessSlug]);

  return (
    <div className="publicShell">
      <header className="publicTopbar">
        <div className="publicTopbar__name">{businessName}</div>
      </header>
      <main className="publicContent">
        <Outlet />
      </main>
    </div>
  );
};

