import React, { useEffect, useState } from 'react';
import { useParams, Outlet } from 'react-router-dom';
import { getPublicBusiness } from '../api/publicClient';

export const PublicClientLayout: React.FC = () => {
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const [businessName, setBusinessName] = useState<string>('העסק');

  useEffect(() => {
    const loadBusiness = async () => {
      if (!businessSlug) return;
      try {
        const business = await getPublicBusiness(businessSlug);
        setBusinessName(business.name);
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

