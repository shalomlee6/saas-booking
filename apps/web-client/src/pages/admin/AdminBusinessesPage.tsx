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
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadBusinesses();
  }, []);

  const loadBusinesses = async () => {
    try {
      setLoading(true);
      setError(null);
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
      setError(null);
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
      setError(null);
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

  const filteredBusinesses = businesses.filter((business) =>
    business.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    business.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: '32px' }}>
          <div className="adminSkeleton adminSkeleton--title" style={{ width: '300px', marginBottom: '8px' }} />
          <div className="adminSkeleton adminSkeleton--text" style={{ width: '200px' }} />
        </div>
        <div className="adminCard">
          <div className="adminSkeleton adminSkeleton--text" style={{ height: '400px' }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#F1F5F9', margin: '0 0 8px 0' }}>
          Manage Businesses
        </h1>
        <p style={{ fontSize: '14px', color: '#94A3B8', margin: 0 }}>
          View and manage all businesses in the system
        </p>
      </div>

      {error && (
        <div
          className="adminCard"
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
            marginBottom: '24px',
            color: '#FCA5A5',
          }}
        >
          {error}
        </div>
      )}

      {/* Create Business Form */}
      <div className="adminCard" style={{ marginBottom: '24px' }}>
        <h2 className="adminCard__title" style={{ marginBottom: '16px' }}>Create New Business</h2>
        <form onSubmit={handleCreateBusiness}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              value={newBusinessName}
              onChange={(e) => setNewBusinessName(e.target.value)}
              placeholder="Business name"
              className="adminInput"
              style={{ flex: 1 }}
              disabled={creating}
            />
            <button
              type="submit"
              className="adminBtn adminBtn--primary"
              disabled={creating || !newBusinessName.trim()}
            >
              {creating ? 'Creating...' : 'Create Business'}
            </button>
          </div>
        </form>
      </div>

      {/* Search */}
      <div className="adminCard" style={{ marginBottom: '24px' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search businesses by name or slug..."
          className="adminInput"
          style={{ width: '100%' }}
        />
      </div>

      {/* Businesses Table */}
      <div className="adminCard">
        <div className="adminCard__header">
          <div>
            <h2 className="adminCard__title">All Businesses</h2>
            <p className="adminCard__subtitle">{filteredBusinesses.length} business{filteredBusinesses.length !== 1 ? 'es' : ''} found</p>
          </div>
        </div>

        {filteredBusinesses.length === 0 ? (
          <div className="adminEmptyState">
            <div className="adminEmptyState__title">
              {searchQuery ? 'No businesses found' : 'No businesses yet'}
            </div>
            <div className="adminEmptyState__text">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Create your first business using the form above'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="adminTable">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBusinesses.map((business) => (
                  <tr key={business._id}>
                    <td style={{ fontWeight: 500 }}>{business.name}</td>
                    <td>
                      <code style={{ background: 'rgba(148, 163, 184, 0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>
                        {business.slug}
                      </code>
                    </td>
                    <td>
                      <span className={`adminBadge--plan adminBadge--plan-${business.settings.plan}`}>
                        {business.settings.plan}
                      </span>
                    </td>
                    <td>
                      {business.settings.features.bookingEnabled ? (
                        <span style={{ color: '#10B981', fontSize: '13px', fontWeight: 500 }}>Active</span>
                      ) : (
                        <span style={{ color: '#94A3B8', fontSize: '13px' }}>Inactive</span>
                      )}
                    </td>
                    <td style={{ color: '#94A3B8', fontSize: '13px' }}>
                      {new Date(business.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="adminBtnGroup" style={{ justifyContent: 'flex-end' }}>
                        <button
                          className="adminBtn adminBtn--primary"
                          onClick={() => handleImpersonate(business._id)}
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                        >
                          Enter as Owner
                        </button>
                        <button
                          className="adminBtn adminBtn--ghost"
                          onClick={() => handleOpenPublic(business.slug)}
                          style={{ fontSize: '12px', padding: '6px 12px' }}
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
        )}
      </div>
    </div>
  );
};
