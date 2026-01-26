import React from 'react';
import { useAuth } from '../auth/AuthContext';

export const ImpersonationBanner: React.FC = () => {
  const { impersonatingBusinessId, business, stopImpersonation } = useAuth();

  if (!impersonatingBusinessId) {
    return null;
  }

  return (
    <div className="impersonationBanner">
      <div className="impersonationBanner__content">
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          width="20"
          height="20"
          className="impersonationBanner__icon"
        >
          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
        </svg>
        <span className="impersonationBanner__text">
          YOU ARE IMPERSONATING: <strong>{business?.name || impersonatingBusinessId}</strong>
        </span>
        <button
          onClick={stopImpersonation}
          className="impersonationBanner__button"
        >
          Exit Impersonation
        </button>
      </div>
    </div>
  );
};

