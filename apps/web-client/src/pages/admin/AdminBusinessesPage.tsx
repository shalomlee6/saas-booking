import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminBusinesses, createAdminBusiness, adminImpersonate, type AdminBusiness } from '../../api/admin';
import { useAuth } from '../../auth/AuthContext';

export const AdminBusinessesPage: React.FC = () => {
  const navigate = useNavigate();
  const { startImpersonation } = useAuth();
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadBusinesses();
  }, []);

  const loadBusinesses = async () => {
    try {
      setLoading(true);
      const data = await getAdminBusinesses();
      setBusinesses(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load businesses');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBusinessName.trim()) return;

    try {
      setCreating(true);
      await createAdminBusiness(newBusinessName.trim());
      setNewBusinessName('');
      await loadBusinesses();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create business');
    } finally {
      setCreating(false);
    }
  };

  const handleImpersonate = async (businessId: string) => {
    try {
      const { token, impersonatingBusinessId } = await adminImpersonate(businessId);
      startImpersonation(token, impersonatingBusinessId);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to impersonate');
    }
  };

  const handleOpenPublic = (slug: string) => {
    window.open(`/public/${slug}`, '_blank');
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        טוען...
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Manage Businesses</h1>

      {error && (
        <div
          style={{
            padding: '12px',
            background: 'rgba(243, 82, 113, 0.1)',
            border: '1px solid var(--pink-500)',
            borderRadius: '8px',
            marginBottom: '20px',
            color: 'var(--pink-500)',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleCreateBusiness} style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={newBusinessName}
            onChange={(e) => setNewBusinessName(e.target.value)}
            placeholder="Business name"
            style={{
              flex: 1,
              padding: '12px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
            }}
            disabled={creating}
          />
          <button
            type="submit"
            className="pill pill--primary"
            disabled={creating || !newBusinessName.trim()}
          >
            {creating ? 'Creating...' : 'Create Business'}
          </button>
        </div>
      </form>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '12px', textAlign: 'right' }}>Name</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Slug</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Plan</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((business) => (
              <tr key={business._id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px' }}>{business.name}</td>
                <td style={{ padding: '12px' }}>{business.slug}</td>
                <td style={{ padding: '12px' }}>{business.settings.plan}</td>
                <td style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="pill pill--primary"
                      onClick={() => handleImpersonate(business._id)}
                      style={{ fontSize: '14px', padding: '6px 12px' }}
                    >
                      Enter as Owner
                    </button>
                    <button
                      className="pill"
                      onClick={() => handleOpenPublic(business.slug)}
                      style={{ fontSize: '14px', padding: '6px 12px' }}
                    >
                      Open Public
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};





