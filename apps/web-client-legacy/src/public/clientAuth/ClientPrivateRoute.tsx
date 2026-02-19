import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useClientAuth } from './ClientAuthContext';

interface ClientPrivateRouteProps {
  children: React.ReactNode;
}

export const ClientPrivateRoute: React.FC<ClientPrivateRouteProps> = ({ children }) => {
  const { isClientAuthed } = useClientAuth();
  const { businessSlug } = useParams<{ businessSlug: string }>();

  if (!isClientAuthed) {
    return <Navigate to={`/public/${businessSlug}/auth`} replace />;
  }

  return <>{children}</>;
};

