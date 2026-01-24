import React from 'react';
import { Link } from 'react-router-dom';

export const AdminHomePage: React.FC = () => {
  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1>Super Admin Dashboard</h1>
        <Link
          to="/dashboard"
          style={{
            padding: '8px 16px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            textDecoration: 'none',
            color: 'var(--text)',
            fontWeight: 500,
          }}
        >
          Back to Dashboard
        </Link>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Link
          to="/admin/businesses"
          style={{
            padding: '16px 24px',
            background: 'var(--primary)',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Manage Businesses
        </Link>
      </div>
    </div>
  );
};

